import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { normalisePlan, type DoitPlan } from '@/constants/subscription';

const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
export const revenueCatEntitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'doit_pro';
export const purchasesConfigured = Boolean(Platform.select({ android: androidKey, ios: iosKey }));

let configured = false;
let configuredUserId: string | undefined;
let packages: PurchasesPackage[] = [];

export type StoreProduct = {
  id: string;
  productId: string;
  title: string;
  price: string;
  period: 'monthly' | 'annual' | 'other';
  monthlyEquivalent?: string;
  tier: Exclude<DoitPlan, 'free'>;
};

export type StoreEntitlement = {
  active: boolean;
  status: 'active' | 'trialing' | 'expired';
  expirationDate?: string;
  managementUrl?: string;
  productId?: string;
  willRenew: boolean;
  store?: string;
  plan: DoitPlan;
};

export async function configurePurchases(userId: string) {
  if (!purchasesConfigured) return false;
  const apiKey = Platform.OS === 'android' ? androidKey! : iosKey!;
  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    configuredUserId = userId;
  } else if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
  return true;
}

export function entitlementFromCustomerInfo(info: CustomerInfo): StoreEntitlement {
  const entitlement = info.entitlements.active[revenueCatEntitlementId];
  if (!entitlement?.isActive) return { active: false, status: 'expired', managementUrl: info.managementURL ?? undefined, willRenew: false, plan: 'free' };
  const plan = normalisePlan(entitlement.productIdentifier.toLowerCase().includes('max') ? 'max' : 'pro');
  return {
    active: true,
    status: entitlement.periodType === 'TRIAL' ? 'trialing' : 'active',
    expirationDate: entitlement.expirationDate ?? undefined,
    managementUrl: info.managementURL ?? undefined,
    productId: entitlement.productIdentifier,
    willRenew: entitlement.willRenew,
    store: entitlement.store,
    plan,
  };
}

export async function loadStoreState(userId: string) {
  if (!(await configurePurchases(userId))) return { entitlement: undefined, products: [] as StoreProduct[] };
  const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
  packages = offerings.current?.availablePackages ?? [];
  return {
    entitlement: entitlementFromCustomerInfo(info),
    products: packages.map((item): StoreProduct => ({
      id: item.identifier,
      productId: item.product.identifier,
      title: item.packageType === 'ANNUAL' ? 'Annual' : item.packageType === 'MONTHLY' ? 'Monthly' : item.product.title,
      price: item.product.priceString,
      period: item.packageType === 'ANNUAL' ? 'annual' : item.packageType === 'MONTHLY' ? 'monthly' : 'other',
      monthlyEquivalent: item.packageType === 'ANNUAL' ? item.product.pricePerMonthString ?? undefined : undefined,
      tier: item.product.identifier.toLowerCase().includes('max') ? 'max' : 'pro',
    })),
  };
}

export async function purchaseStorePackage(userId: string, packageId?: string) {
  await configurePurchases(userId);
  if (!packages.length) await loadStoreState(userId);
  const selected = packages.find((item) => item.identifier === packageId) ?? packages.find((item) => item.packageType === 'ANNUAL') ?? packages[0];
  if (!selected) return { error: 'No Google Play subscription is available yet. Check the active RevenueCat offering.' };
  try {
    const result = await Purchases.purchasePackage(selected);
    return { entitlement: entitlementFromCustomerInfo(result.customerInfo), product: selected.product.identifier };
  } catch (error) {
    const purchaseError = error as { code?: string; message?: string; userCancelled?: boolean };
    if (purchaseError.userCancelled || purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { cancelled: true };
    return { error: purchaseError.message || 'Google Play could not complete the purchase.' };
  }
}

export async function restoreStorePurchases(userId: string) {
  await configurePurchases(userId);
  const info = await Purchases.restorePurchases();
  return entitlementFromCustomerInfo(info);
}

export async function openStoreManagement(managementUrl?: string) {
  if (!managementUrl) throw new Error('Google Play did not provide a subscription-management link.');
  const { Linking } = await import('react-native');
  await Linking.openURL(managementUrl);
  return { cancelled: false };
}

export async function confirmStripeCancellation() {
  throw new Error('Stripe cancellation confirmation is only available in the DOIT web app.');
}
