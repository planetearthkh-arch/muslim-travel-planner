import UIKit
import Capacitor
import StoreKit
import UserNotifications

private let safarMatePremiumProductID = "com.planetearthkh.safarmate.premium.lifetime"
private let safarMateLegacyPremiumMaximumBuild = 154

@objc(SafarMateStorePlugin)
public class SafarMateStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SafarMateStorePlugin"
    public let jsName = "SafarMateStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    @objc public func getStatus(_ call: CAPPluginCall) {
        Task {
            let status = await premiumStatus()
            call.resolve(status)
        }
    }

    @objc public func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Product.products(for: [safarMatePremiumProductID]).first else {
                    var status = await premiumStatus()
                    status["outcome"] = "failed"
                    call.resolve(status)
                    return
                }

                switch try await product.purchase() {
                case .success(let verificationResult):
                    switch verificationResult {
                    case .verified(let transaction):
                        await transaction.finish()
                        var status = await premiumStatus()
                        status["outcome"] = "purchased"
                        call.resolve(status)
                    case .unverified:
                        call.reject("The App Store could not verify this purchase.")
                    }
                case .pending:
                    var status = await premiumStatus()
                    status["outcome"] = "pending"
                    call.resolve(status)
                case .userCancelled:
                    var status = await premiumStatus()
                    status["outcome"] = "cancelled"
                    call.resolve(status)
                @unknown default:
                    var status = await premiumStatus()
                    status["outcome"] = "failed"
                    call.resolve(status)
                }
            } catch {
                call.reject("Premium purchase failed.", nil, error)
            }
        }
    }

    @objc public func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var status = await premiumStatus()
                status["outcome"] = (status["entitled"] as? Bool == true) ? "purchased" : "failed"
                call.resolve(status)
            } catch {
                call.reject("Purchases could not be restored.", nil, error)
            }
        }
    }

    private func premiumStatus() async -> [String: Any] {
        let product = try? await Product.products(for: [safarMatePremiumProductID]).first
        let purchased = await hasVerifiedPremiumEntitlement()
        let legacy = await legacyPremiumStatus()
        let entitled = purchased || legacy.grandfathered

        var result: [String: Any] = [
            "available": product != nil,
            "entitled": entitled,
            "grandfathered": legacy.grandfathered,
            "productId": safarMatePremiumProductID,
            "source": legacy.grandfathered ? "legacy" : (purchased ? "purchase" : "none")
        ]
        if let product {
            result["displayPrice"] = product.displayPrice
            result["displayName"] = product.displayName
            result["productDescription"] = product.description
        }
        if let originalAppVersion = legacy.originalAppVersion {
            result["originalAppVersion"] = originalAppVersion
        }
        return result
    }

    private func hasVerifiedPremiumEntitlement() async -> Bool {
        for await verificationResult in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verificationResult else { continue }
            if transaction.productID == safarMatePremiumProductID {
                return true
            }
        }
        return false
    }

    private func legacyPremiumStatus() async -> (grandfathered: Bool, originalAppVersion: String?) {
        do {
            let verificationResult = try await AppTransaction.shared
            guard case .verified(let appTransaction) = verificationResult else {
                return (false, nil)
            }
            let originalAppVersion = appTransaction.originalAppVersion
            guard let originalBuild = Int(originalAppVersion) else {
                // StoreKit sandbox reports "1.0"; do not grant legacy access there,
                // so purchase and restore can be tested correctly before release.
                return (false, originalAppVersion)
            }
            return (originalBuild <= safarMateLegacyPremiumMaximumBuild, originalAppVersion)
        } catch {
            return (false, nil)
        }
    }
}

class SafarMateBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SafarMateStorePlugin())
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }
}
