package com.planetearthkids.muslimtravelplanner;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class SafarMateStorePluginTest {
    @Test
    public void recognizesOnlyTheSafarMateLifetimeProduct() {
        assertTrue(SafarMateStorePlugin.containsProduct(
            Collections.singletonList("com.planetearthkh.safarmate.premium.lifetime")
        ));
        assertTrue(SafarMateStorePlugin.containsProduct(
            Arrays.asList("other.product", "com.planetearthkh.safarmate.premium.lifetime")
        ));
        assertFalse(SafarMateStorePlugin.containsProduct(Collections.singletonList("other.product")));
        assertFalse(SafarMateStorePlugin.containsProduct(Collections.emptyList()));
        assertFalse(SafarMateStorePlugin.containsProduct(null));
    }
}
