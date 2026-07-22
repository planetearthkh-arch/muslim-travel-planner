package com.planetearthkids.muslimtravelplanner;

import android.app.Activity;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "SafarMateStore")
public class SafarMateStorePlugin extends Plugin implements PurchasesUpdatedListener {
    public static final String PRODUCT_ID = "com.planetearthkh.safarmate.premium.lifetime";

    private BillingClient billingClient;
    private boolean connecting;
    private final List<PendingAction> pendingActions = new ArrayList<>();
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
        connectIfNeeded(null, () -> queryOwnedPurchases((billingResult, purchases) -> acknowledgeOwnedPurchases(purchases)));
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        connectIfNeeded(call, () -> loadStatus(null, call));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        synchronized (this) {
            if (pendingPurchaseCall != null) {
                call.reject("A Premium purchase is already in progress.");
                return;
            }
        }

        connectIfNeeded(call, () -> queryOwnedPurchases((billingResult, purchases) -> {
            if (!isOk(billingResult)) {
                call.reject("Google Play could not check existing purchases: " + billingResult.getDebugMessage());
                return;
            }

            Purchase purchased = findPurchase(purchases, Purchase.PurchaseState.PURCHASED);
            if (purchased != null) {
                acknowledgePurchase(purchased);
                loadStatus("purchased", call);
                return;
            }

            Purchase pending = findPurchase(purchases, Purchase.PurchaseState.PENDING);
            if (pending != null) {
                loadStatus("pending", call);
                return;
            }

            queryProductDetails((billingResultDetails, productDetails) -> {
                if (!isOk(billingResultDetails) || productDetails == null) {
                    call.reject("SafarMate Premium Lifetime is not available from Google Play yet.");
                    return;
                }

                Activity activity = getActivity();
                if (activity == null) {
                    call.reject("The Google Play purchase screen is not available.");
                    return;
                }

                BillingFlowParams.ProductDetailsParams.Builder productParams =
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails);
                ProductDetails.OneTimePurchaseOfferDetails offer = selectedOffer(productDetails);
                if (offer != null && offer.getOfferToken() != null && !offer.getOfferToken().isEmpty()) {
                    productParams.setOfferToken(offer.getOfferToken());
                }

                BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(productParams.build()))
                    .build();

                synchronized (this) {
                    pendingPurchaseCall = call;
                }
                activity.runOnUiThread(() -> {
                    BillingResult launchResult = billingClient.launchBillingFlow(activity, flowParams);
                    if (!isOk(launchResult)) {
                        clearPendingPurchaseCall();
                        if (launchResult.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                            loadStatus("purchased", call);
                        } else if (launchResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
                            loadStatus("cancelled", call);
                        } else {
                            call.reject("Google Play could not start the purchase: " + launchResult.getDebugMessage());
                        }
                    }
                });
            });
        }));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        connectIfNeeded(call, () -> queryOwnedPurchases((billingResult, purchases) -> {
            if (!isOk(billingResult)) {
                call.reject("Google Play could not restore purchases: " + billingResult.getDebugMessage());
                return;
            }
            Purchase purchased = findPurchase(purchases, Purchase.PurchaseState.PURCHASED);
            if (purchased != null) {
                acknowledgePurchase(purchased);
                loadStatus("purchased", call);
            } else if (findPurchase(purchases, Purchase.PurchaseState.PENDING) != null) {
                loadStatus("pending", call);
            } else {
                loadStatus("failed", call);
            }
        }));
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call = clearPendingPurchaseCall();

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            Purchase purchased = findPurchase(purchases, Purchase.PurchaseState.PURCHASED);
            if (purchased != null) {
                acknowledgePurchase(purchased);
                if (call != null) loadStatus("purchased", call);
                return;
            }
            if (findPurchase(purchases, Purchase.PurchaseState.PENDING) != null) {
                if (call != null) loadStatus("pending", call);
                return;
            }
        }

        if (call == null) {
            if (purchases != null) acknowledgeOwnedPurchases(purchases);
            return;
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            loadStatus("cancelled", call);
        } else if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            loadStatus("purchased", call);
        } else {
            loadStatus("failed", call);
        }
    }

    private void loadStatus(String outcome, PluginCall call) {
        queryProductDetails((productResult, productDetails) -> queryOwnedPurchases((purchaseResult, purchases) -> {
            if (!isOk(purchaseResult)) {
                call.reject("Google Play could not check Premium access: " + purchaseResult.getDebugMessage());
                return;
            }
            acknowledgeOwnedPurchases(purchases);
            call.resolve(statusPayload(productDetails, purchases, outcome));
        }));
    }

    private void queryProductDetails(ProductDetailsCallback callback) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_ID)
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            ProductDetails productDetails = null;
            if (isOk(billingResult) && result != null) {
                for (ProductDetails candidate : result.getProductDetailsList()) {
                    if (PRODUCT_ID.equals(candidate.getProductId())) {
                        productDetails = candidate;
                        break;
                    }
                }
            }
            callback.complete(billingResult, productDetails);
        });
    }

    private void queryOwnedPurchases(PurchasesCallback callback) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        billingClient.queryPurchasesAsync(params, callback::complete);
    }

    private void acknowledgeOwnedPurchases(List<Purchase> purchases) {
        if (purchases == null) return;
        for (Purchase purchase : purchases) {
            if (isSafarMatePurchase(purchase) && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                acknowledgePurchase(purchase);
            }
        }
    }

    private void acknowledgePurchase(Purchase purchase) {
        if (purchase.isAcknowledged()) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, ignored -> {
            // Entitlement is derived from Google Play's owned purchase query. Any transient
            // acknowledgement failure is retried on the next status refresh or app launch.
        });
    }

    private JSObject statusPayload(ProductDetails productDetails, List<Purchase> purchases, String outcome) {
        Purchase purchased = findPurchase(purchases, Purchase.PurchaseState.PURCHASED);
        boolean entitled = purchased != null;
        JSObject result = new JSObject()
            .put("available", productDetails != null)
            .put("entitled", entitled)
            .put("grandfathered", false)
            .put("productId", PRODUCT_ID)
            .put("source", entitled ? "purchase" : "none");

        if (productDetails != null) {
            result.put("displayName", productDetails.getName());
            result.put("productDescription", productDetails.getDescription());
            ProductDetails.OneTimePurchaseOfferDetails offer = selectedOffer(productDetails);
            if (offer != null) result.put("displayPrice", offer.getFormattedPrice());
        }
        if (outcome != null) result.put("outcome", outcome);
        return result;
    }

    private static ProductDetails.OneTimePurchaseOfferDetails selectedOffer(ProductDetails productDetails) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = productDetails.getOneTimePurchaseOfferDetailsList();
        if (offers != null && !offers.isEmpty()) return offers.get(0);
        return productDetails.getOneTimePurchaseOfferDetails();
    }

    private static Purchase findPurchase(List<Purchase> purchases, int state) {
        if (purchases == null) return null;
        for (Purchase purchase : purchases) {
            if (isSafarMatePurchase(purchase) && purchase.getPurchaseState() == state) return purchase;
        }
        return null;
    }

    public static boolean containsProduct(List<String> products) {
        return products != null && products.contains(PRODUCT_ID);
    }

    private static boolean isSafarMatePurchase(Purchase purchase) {
        return purchase != null && containsProduct(purchase.getProducts());
    }

    private static boolean isOk(BillingResult result) {
        return result != null && result.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private void connectIfNeeded(PluginCall call, Runnable action) {
        if (billingClient != null && billingClient.isReady()) {
            action.run();
            return;
        }

        boolean shouldConnect = false;
        synchronized (this) {
            pendingActions.add(new PendingAction(call, action));
            if (!connecting) {
                connecting = true;
                shouldConnect = true;
            }
        }
        if (!shouldConnect) return;

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                List<PendingAction> actions;
                synchronized (SafarMateStorePlugin.this) {
                    connecting = false;
                    actions = new ArrayList<>(pendingActions);
                    pendingActions.clear();
                }
                if (isOk(billingResult)) {
                    for (PendingAction pending : actions) pending.action.run();
                } else {
                    for (PendingAction pending : actions) {
                        if (pending.call != null) {
                            pending.call.reject("Google Play Billing is unavailable: " + billingResult.getDebugMessage());
                        }
                    }
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Billing 9 automatic service reconnection handles the next request.
            }
        });
    }

    private synchronized PluginCall clearPendingPurchaseCall() {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        return call;
    }

    private interface ProductDetailsCallback {
        void complete(BillingResult billingResult, ProductDetails productDetails);
    }

    private interface PurchasesCallback {
        void complete(BillingResult billingResult, List<Purchase> purchases);
    }

    private static final class PendingAction {
        private final PluginCall call;
        private final Runnable action;

        private PendingAction(PluginCall call, Runnable action) {
            this.call = call;
            this.action = action;
        }
    }
}
