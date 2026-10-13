import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './auth/RequireAuth'
import { LoginPage } from './features/auth/LoginPage'
import { AcceptInvitePage } from './features/auth/AcceptInvitePage'
import { CreateStorePage } from './features/auth/CreateStorePage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignupPage } from './features/auth/SignupPage'
import { ShopProvider } from './shop/ShopProvider'
import { StoreDetailsPage } from './features/settings/store/StoreDetailsPage'
import { BillingPage } from './features/settings/billing/BillingPage'
import { MarketsPage } from './features/settings/markets/MarketsPage'
import { TaxesPage } from './features/settings/taxes/TaxesPage'
import { DomainsPage } from './features/settings/domains/DomainsPage'
import { IntegrationsPage } from './features/settings/integrations/IntegrationsPage'
import { NotificationPreferencesPage } from './features/settings/notifications/NotificationPreferencesPage'
import { AppsPage } from './features/settings/apps/AppsPage'
import { CustomerAccountsPage } from './features/settings/customerAccounts/CustomerAccountsPage'
import { LanguagesPage } from './features/settings/languages/LanguagesPage'
import { CustomerPrivacyPage } from './features/settings/privacy/CustomerPrivacyPage'
import { PoliciesPage } from './features/settings/policies/PoliciesPage'
import { PrivacyPage } from './features/privacy/PrivacyPage'
import { TranslatePage } from './features/settings/languages/TranslatePage'
import { AuthorizeAppPage } from './features/settings/apps/AuthorizeAppPage'
import { ThemesPage } from './features/merchandising/themes/ThemesPage'
import { ThemeEditorPage } from './features/merchandising/themes/ThemeEditorPage'
import { ThemeCodePage } from './features/merchandising/themes/ThemeCodePage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { CategoriesPage } from './features/categories/CategoriesPage'
import { CollectionFormPage } from './features/collections/CollectionFormPage'
import { CollectionsPage } from './features/collections/CollectionsPage'
import { CustomerDetailPage } from './features/customers/CustomerDetailPage'
import { CustomersListPage } from './features/customers/CustomersListPage'
import { ContactMessagesPage } from './features/customers/ContactMessagesPage'
import { SubscribersPage } from './features/customers/SubscribersPage'
import { SegmentsPage } from './features/customers/segments/SegmentsPage'
import { SegmentDetailPage } from './features/customers/segments/SegmentDetailPage'
import { SegmentFormPage } from './features/customers/segments/SegmentFormPage'
import { DiscountFormPage } from './features/discounts/DiscountFormPage'
import { DiscountsListPage } from './features/discounts/DiscountsListPage'
import { GiftCardsPage } from './features/giftCards/GiftCardsPage'
import { MediaLibraryPage } from './features/media/MediaLibraryPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { ReviewsPage } from './features/reviews/ReviewsPage'
import { AbandonedCartsPage } from './features/fulfilment/AbandonedCartsPage'
import { InvoicesPage } from './features/fulfilment/InvoicesPage'
import { ReturnsPage } from './features/fulfilment/ReturnsPage'
import { ShipmentsPage } from './features/fulfilment/ShipmentsPage'
import { OrderDetailPage } from './features/orders/OrderDetailPage'
import { OrdersListPage } from './features/orders/OrdersListPage'
import { ProductFormPage } from './features/products/ProductFormPage'
import { ProductsListPage } from './features/products/ProductsListPage'
import { CatalogProductPage } from './features/catalog/CatalogProductPage'
import { CatalogProductsPage } from './features/catalog/CatalogProductsPage'
import { CustomFieldsPage } from './features/catalog/CustomFieldsPage'
import { MetaobjectEntriesPage, MetaobjectsPage } from './features/catalog/MetaobjectsPage'
import { ReengagementPage } from './features/reengagement/ReengagementPage'
import { MenuSettingsPage } from './features/settings/MenuSettingsPage'
import { ShippingSettingsPage } from './features/settings/ShippingSettingsPage'
import { PaymentSettingsPage } from './features/settings/PaymentSettingsPage'
import { RolesPage } from './features/staff/RolesPage'
import { StaffFormPage } from './features/staff/StaffFormPage'
import { StaffPage } from './features/staff/StaffPage'
// Content module imports
import { PagesListPage } from './features/content/pages/PagesListPage'
import { PageFormPage } from './features/content/pages/PageFormPage'
import { ArticlesListPage } from './features/content/articles/ArticlesListPage'
import { ArticleFormPage } from './features/content/articles/ArticleFormPage'
import { BlogsListPage } from './features/content/articles/BlogsListPage'
import { CommentsPage } from './features/content/comments/CommentsPage'
import { CreatorsListPage } from './features/content/creators/CreatorsListPage'
import { SectionsListPage } from './features/content/sections/SectionsListPage'
import { SectionEditorPage } from './features/content/sections/SectionEditorPage'
import { AnnouncementsPage } from './features/content/announcements/AnnouncementsPage'
import { PageBuilderPage } from './features/merchandising/pages/PageBuilderPage'
import { TemplatesPage } from './features/messaging/TemplatesPage'
import { TemplateEditorPage } from './features/messaging/TemplateEditorPage'
import { CampaignsPage } from './features/messaging/CampaignsPage'
import { CampaignEditorPage } from './features/messaging/CampaignEditorPage'
import { ActivityPage } from './features/messaging/ActivityPage'
import { SendersPage } from './features/messaging/SendersPage'
import { ShelvesPage } from './features/merchandising/shelves/ShelvesPage'
import { ShelfFormPage } from './features/merchandising/shelves/ShelfFormPage'
import { BannersListPage } from './features/content/banners/BannersListPage'
import { BannerFormPage } from './features/content/banners/BannerFormPage'
import { FAQsListPage } from './features/content/faqs/FAQsListPage'
import { FAQFormPage } from './features/content/faqs/FAQFormPage'
import { MenusListPage } from './features/content/menus/MenusListPage'
import { MenuFormPage } from './features/content/menus/MenuFormPage'
import { RedirectsListPage } from './features/content/redirects/RedirectsListPage'
import { RedirectFormPage } from './features/content/redirects/RedirectFormPage'
import { ConsoleLayout } from './features/console/ConsoleLayout'
import { ConsoleOverviewPage } from './features/console/ConsoleOverviewPage'
import { ConsoleStoresPage } from './features/console/ConsoleStoresPage'
import { ConsoleStoreDetailPage } from './features/console/ConsoleStoreDetailPage'
import { ConsolePlansPage } from './features/console/ConsolePlansPage'
import { ConsoleBillingPage } from './features/console/ConsoleBillingPage'
import { ConsoleExchangeRatesPage } from './features/console/ConsoleExchangeRatesPage'
import { ConsoleAppsPage } from './features/console/ConsoleAppsPage'
import { ConsoleJobsPage } from './features/console/ConsoleJobsPage'
import { ConsoleEmailsPage } from './features/console/ConsoleEmailsPage'
import { ConsoleAuditPage } from './features/console/ConsoleAuditPage'
import { ConsoleDomainsPage } from './features/console/ConsoleDomainsPage'
import { AuditLogPage } from './features/settings/audit/AuditLogPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route element={<RequireAuth />}>
        <Route
          element={
            <ShopProvider>
              <AppLayout />
            </ShopProvider>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsListPage />} />
          {/* "new" is matched by :id and handled inside the form component,
              so creating and editing stay one screen with one save path. */}
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id" element={<ProductFormPage />} />
          {/* Products (new): the generic catalog, beside the classic screens until it replaces them. */}
          <Route path="catalog/products" element={<CatalogProductsPage />} />
          <Route path="catalog/products/new" element={<CatalogProductPage />} />
          <Route path="catalog/products/:id" element={<CatalogProductPage />} />
          <Route path="catalog/custom-fields" element={<CustomFieldsPage />} />
          <Route path="catalog/metaobjects" element={<MetaobjectsPage />} />
          <Route path="catalog/metaobjects/:type" element={<MetaobjectEntriesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/new" element={<CollectionFormPage />} />
          <Route path="collections/:id" element={<CollectionFormPage />} />
          <Route path="media" element={<MediaLibraryPage />} />

          <Route path="orders" element={<OrdersListPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />

          <Route path="shipments" element={<ShipmentsPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="abandoned" element={<AbandonedCartsPage />} />

          <Route path="customers" element={<CustomersListPage />} />
          <Route path="reengagement" element={<ReengagementPage />} />
          <Route path="segments" element={<SegmentsPage />} />
          <Route path="segments/new" element={<SegmentFormPage />} />
          <Route path="segments/:id" element={<SegmentDetailPage />} />
          <Route path="segments/:id/edit" element={<SegmentFormPage />} />
          <Route path="customers/messages" element={<ContactMessagesPage />} />
          <Route path="customers/subscribers" element={<SubscribersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />

          <Route path="discounts" element={<DiscountsListPage />} />
          <Route path="gift-cards" element={<GiftCardsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="discounts/new" element={<DiscountFormPage />} />
          <Route path="discounts/:id" element={<DiscountFormPage />} />

          {/* Content Module Routes */}
          <Route path="content/pages" element={<PagesListPage />} />
          <Route path="content/pages/new" element={<PageFormPage />} />
          <Route path="content/pages/:id" element={<PageFormPage />} />

          <Route path="content/articles" element={<ArticlesListPage />} />
          <Route path="content/articles/new" element={<ArticleFormPage />} />
          <Route path="content/articles/:id" element={<ArticleFormPage />} />
          <Route path="content/blogs" element={<BlogsListPage />} />
          <Route path="content/comments" element={<CommentsPage />} />
          <Route path="content/creators" element={<CreatorsListPage />} />
          <Route path="content/sections" element={<SectionsListPage />} />
          <Route path="content/sections/:id" element={<SectionEditorPage />} />

          <Route path="content/announcements" element={<AnnouncementsPage />} />

          {/* Messaging — templates, campaigns, the outbox and the senders
              behind them. /notifications is the group; it has no page of its
              own, so it lands on the templates. */}
          <Route path="notifications" element={<Navigate to="/notifications/templates" replace />} />
          <Route path="notifications/templates" element={<TemplatesPage />} />
          <Route path="notifications/templates/new" element={<TemplateEditorPage />} />
          <Route path="notifications/templates/:id" element={<TemplateEditorPage />} />
          <Route path="notifications/campaigns" element={<CampaignsPage />} />
          <Route path="notifications/campaigns/:id" element={<CampaignEditorPage />} />
          <Route path="notifications/activity" element={<ActivityPage />} />
          <Route path="notifications/senders" element={<SendersPage />} />

          <Route path="merchandising/pages" element={<PageBuilderPage />} />
          <Route path="merchandising/themes" element={<ThemesPage />} />
          <Route path="merchandising/themes/:id" element={<ThemeEditorPage />} />
          <Route path="merchandising/themes/:id/code" element={<ThemeCodePage />} />
          <Route path="merchandising/shelves" element={<ShelvesPage />} />
          <Route path="merchandising/shelves/new" element={<ShelfFormPage />} />
          <Route path="merchandising/shelves/:id" element={<ShelfFormPage />} />
          <Route path="content/banners" element={<BannersListPage />} />
          <Route path="content/banners/new" element={<BannerFormPage />} />
          <Route path="content/banners/:id" element={<BannerFormPage />} />

          <Route path="content/faqs" element={<FAQsListPage />} />
          <Route path="content/faqs/new" element={<FAQFormPage />} />
          <Route path="content/faqs/:id" element={<FAQFormPage />} />

          <Route path="content/menus" element={<MenusListPage />} />
          <Route path="content/menus/new" element={<MenuFormPage />} />
          <Route path="content/menus/:id" element={<MenuFormPage />} />

          <Route path="content/redirects" element={<RedirectsListPage />} />
          <Route path="content/redirects/new" element={<RedirectFormPage />} />
          <Route path="content/redirects/:id" element={<RedirectFormPage />} />

          <Route path="settings/staff" element={<StaffPage />} />
          <Route path="settings/staff/new" element={<StaffFormPage />} />
          <Route path="settings/staff/:id" element={<StaffFormPage />} />
          <Route path="settings/roles" element={<RolesPage />} />
          <Route path="settings/navigation" element={<MenuSettingsPage />} />
          <Route path="settings/customer-privacy" element={<CustomerPrivacyPage />} />
          <Route path="settings/policies" element={<PoliciesPage />} />
          <Route path="settings/shipping" element={<ShippingSettingsPage />} />
          <Route path="settings/payments" element={<PaymentSettingsPage />} />
          <Route path="settings" element={<Navigate to="/settings/store" replace />} />
          <Route path="settings/store" element={<StoreDetailsPage />} />
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="settings/markets" element={<MarketsPage />} />
          <Route path="settings/taxes" element={<TaxesPage />} />
          <Route path="settings/domains" element={<DomainsPage />} />
          <Route path="settings/integrations" element={<IntegrationsPage />} />
          <Route path="settings/notifications" element={<NotificationPreferencesPage />} />
          <Route path="settings/apps" element={<AppsPage />} />
          <Route path="settings/customer-accounts" element={<CustomerAccountsPage />} />
          <Route path="settings/audit" element={<AuditLogPage />} />
          <Route path="settings/languages" element={<LanguagesPage />} />
          <Route path="settings/languages/:locale/translate" element={<TranslatePage />} />
          {/* Where an app sends a merchant to install it (Shopify's /admin/oauth/authorize). */}
          <Route path="apps/authorize" element={<AuthorizeAppPage />} />
          <Route path="oauth/authorize" element={<AuthorizeAppPage />} />
          <Route path="stores/new" element={<CreateStorePage />} />
          {/* Staff moved under Settings to match the seeded menu; the old path
              is kept as a redirect so existing bookmarks survive. */}
          <Route path="staff" element={<Navigate to="/settings/staff" replace />} />
        </Route>

        {/* The platform operators' console: outside any one store. */}
        <Route path="console" element={<ConsoleLayout />}>
          <Route index element={<ConsoleOverviewPage />} />
          <Route path="stores" element={<ConsoleStoresPage />} />
          <Route path="stores/:id" element={<ConsoleStoreDetailPage />} />
          <Route path="plans" element={<ConsolePlansPage />} />
          <Route path="billing" element={<ConsoleBillingPage />} />
          <Route path="exchange-rates" element={<ConsoleExchangeRatesPage />} />
          <Route path="apps" element={<ConsoleAppsPage />} />
          <Route path="jobs" element={<ConsoleJobsPage />} />
          <Route path="emails" element={<ConsoleEmailsPage />} />
          <Route path="audit" element={<ConsoleAuditPage />} />
          <Route path="domains" element={<ConsoleDomainsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
