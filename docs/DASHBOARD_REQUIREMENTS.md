# Dashboard Module - Requirements Document

## Overview
The Dashboard module serves as the primary landing page for the Veylog Admin panel, providing real-time insights, key metrics, and quick actions for administrators to monitor and manage the e-commerce platform effectively.

## Context & Architecture Alignment

### Menu Integration
- **Menu Key**: `dashboard`
- **Title**: Dashboard  
- **Subtitle**: Today at a glance
- **Icon**: `dashboard`
- **Route**: `/dashboard`
- **Section**: Overview
- **Status**: Currently `coming_soon`, to be changed to `available` upon implementation
- **Permission Required**: `analytics.view`

### System Architecture Principles
Following the established frontend patterns:
- **React 19** with TypeScript for type safety
- **MUI v9** components for consistent UI/UX
- **TanStack Query v5** for data fetching, caching, and real-time updates
- **Feature-based architecture** (`src/features/dashboard/`)
- **Separation of concerns**: hooks, components, types, and API calls
- **Industry-grade code quality**: senior-level design patterns, optimization, and maintainability

---

## Functional Requirements

### FR-1: Dashboard Overview Screen

#### FR-1.1: Key Performance Indicators (KPIs)
Display critical business metrics in card format:

1. **Revenue Metrics**
   - Today's Revenue
   - This Month's Revenue (MTD)
   - Last Month's Revenue
   - Revenue Growth (% comparison)

2. **Order Metrics**
   - Today's Orders Count
   - Pending Orders Count
   - Processing Orders Count
   - Average Order Value (AOV)

3. **Product Metrics**
   - Total Products Count
   - Published Products Count
   - Low Stock Items Count
   - Out of Stock Items Count

4. **Customer Metrics**
   - New Customers Today
   - Total Active Customers
   - Customer Lifetime Value (CLV)
   - Returning Customer Rate

#### FR-1.2: Visual Data Representation
1. **Revenue Chart**
   - Line/Area chart showing revenue trends
   - Time range selector: 7D, 30D, 90D, 1Y
   - Comparison with previous period
   - Interactive tooltips

2. **Orders Chart**
   - Bar chart showing order volume by status
   - Breakdown: Pending, Processing, Shipped, Delivered, Cancelled
   - Time-based filtering

3. **Top Products Widget**
   - List of top 5 selling products
   - Show: Product thumbnail, name, units sold, revenue
   - Link to product detail page

4. **Recent Orders Widget**
   - List of last 10 orders
   - Show: Order ID, Customer name, Amount, Status, Timestamp
   - Quick action buttons: View Details
   - Link to orders list

#### FR-1.3: Quick Actions Panel
Contextual actions based on user permissions:
- Create New Product
- Create New Discount
- View Pending Orders
- View Low Stock Items
- View Abandoned Carts

#### FR-1.4: Alerts & Notifications
Display critical alerts requiring immediate attention:
- Low stock warnings (configurable threshold)
- Failed payment notifications
- Pending returns/refunds
- System errors or issues
- Priority customer inquiries

---

### FR-2: Real-Time Data Updates

#### FR-2.1: Auto-Refresh Strategy
- KPI cards: Refresh every 60 seconds
- Charts: Refresh every 5 minutes
- Recent orders: Refresh every 30 seconds
- Alerts: Refresh every 15 seconds
- Use TanStack Query's background refetching
- Show loading indicators only on manual refresh

#### FR-2.2: Manual Refresh
- Global refresh button in page header
- Timestamp showing "Last updated: X minutes ago"
- Loading states for each widget during refresh

---

### FR-3: Permission-Based Access Control

#### FR-3.1: Data Visibility
- Dashboard requires `analytics.view` permission
- Revenue data requires `orders.view` permission
- Customer data requires `customers.view` permission
- Product data requires `products.view` permission
- Graceful degradation: hide widgets if permissions missing

#### FR-3.2: Action Availability
- Quick actions filtered by user's granted permissions
- Show disabled state for unavailable actions with tooltip explaining why

---

### FR-4: Performance Optimization

#### FR-4.1: Data Loading Strategy
- Implement staggered loading (critical metrics first)
- Use React.lazy() for chart components
- Implement skeleton loaders for all widgets
- Paginate recent orders/products lists

#### FR-4.2: Caching Strategy
- Cache dashboard data for 60 seconds (staleTime)
- Implement cache invalidation on relevant mutations
- Use optimistic updates where applicable

---

## Technical Requirements

### TR-1: API Endpoints Required

```
GET /admin/api/v1/dashboard/overview
  Response: {
    revenue: {
      today: number,
      month: number,
      lastMonth: number,
      growth: number
    },
    orders: {
      today: number,
      pending: number,
      processing: number,
      avgValue: number
    },
    products: {
      total: number,
      published: number,
      lowStock: number,
      outOfStock: number
    },
    customers: {
      newToday: number,
      totalActive: number,
      clv: number,
      returningRate: number
    }
  }

GET /admin/api/v1/dashboard/revenue-chart
  Query: period=7d|30d|90d|1y
  Response: {
    data: Array<{ date: string, revenue: number, orders: number }>,
    comparison: { growth: number, previousTotal: number }
  }

GET /admin/api/v1/dashboard/orders-chart
  Query: period=7d|30d
  Response: {
    data: Array<{ status: string, count: number, revenue: number }>
  }

GET /admin/api/v1/dashboard/top-products
  Query: limit=5, period=7d|30d
  Response: {
    products: Array<{
      id: number,
      name: string,
      thumbnail: string,
      unitsSold: number,
      revenue: number
    }>
  }

GET /admin/api/v1/dashboard/recent-orders
  Query: limit=10
  Response: {
    orders: Array<{
      id: number,
      publicId: string,
      customerName: string,
      amount: number,
      status: string,
      createdAt: string
    }>
  }

GET /admin/api/v1/dashboard/alerts
  Response: {
    alerts: Array<{
      id: number,
      type: 'low_stock'|'failed_payment'|'pending_return'|'system_error',
      severity: 'info'|'warning'|'critical',
      title: string,
      message: string,
      link: string?,
      createdAt: string
    }>
  }
```

### TR-2: Component Architecture

```
src/features/dashboard/
├── DashboardPage.tsx              # Main page component
├── components/
│   ├── KPICard.tsx                # Reusable KPI metric card
│   ├── RevenueChart.tsx           # Revenue trend chart
│   ├── OrdersChart.tsx            # Orders by status chart
│   ├── TopProductsWidget.tsx     # Top products list
│   ├── RecentOrdersWidget.tsx    # Recent orders list
│   ├── QuickActionsPanel.tsx     # Quick action buttons
│   ├── AlertsWidget.tsx          # Alerts and notifications
│   └── DashboardSkeleton.tsx     # Loading skeleton
├── hooks/
│   ├── useDashboard.ts           # Main dashboard data hook
│   ├── useDashboardOverview.ts   # KPI metrics
│   ├── useDashboardCharts.ts     # Chart data
│   ├── useTopProducts.ts         # Top products
│   ├── useRecentOrders.ts        # Recent orders
│   └── useDashboardAlerts.ts     # Alerts
├── types/
│   └── dashboard.types.ts        # TypeScript interfaces
└── api/
    └── dashboardApi.ts           # API client functions
```

### TR-3: Design Patterns & Best Practices

#### TR-3.1: State Management
- Use TanStack Query for server state
- Local UI state with React hooks (useState, useReducer)
- No global state library needed for dashboard
- Implement proper loading, error, and empty states

#### TR-3.2: Code Quality Standards
- **TypeScript Strict Mode**: All types explicitly defined
- **Error Handling**: Comprehensive try-catch with user-friendly messages
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Testing**: Unit tests for hooks, integration tests for components
- **Code Documentation**: JSDoc comments for complex logic
- **Performance**: React.memo for expensive components, useMemo/useCallback for optimization

#### TR-3.3: Design System Compliance
- Use MUI theme tokens from `theme.ts`
- Consistent spacing: 8px base unit (MUI default)
- Typography hierarchy from existing design system
- Color palette: match existing products, orders modules
- Responsive breakpoints: xs, sm, md, lg, xl

### TR-4: Error Handling Strategy

#### TR-4.1: Network Errors
- Show error boundary for critical failures
- Toast notifications for non-critical errors
- Retry mechanism with exponential backoff
- Fallback UI with manual retry button

#### TR-4.2: Permission Errors
- Graceful widget hiding/disabling
- Informative tooltip messages
- No console errors or broken UI

#### TR-4.3: Data Validation
- Validate API responses against TypeScript types
- Handle null/undefined values safely
- Provide default values for missing data

---

## Non-Functional Requirements

### NFR-1: Performance
- **Initial Load**: < 2 seconds for complete dashboard
- **Time to Interactive (TTI)**: < 3 seconds
- **Widget Loading**: Staggered, non-blocking
- **Chart Rendering**: < 500ms
- **Bundle Size**: Keep feature module < 100KB gzipped

### NFR-2: Scalability
- Handle datasets up to 10,000 orders without performance degradation
- Efficient data aggregation on backend
- Pagination for large lists
- Implement virtual scrolling if needed

### NFR-3: Accessibility (WCAG 2.2 AA)
- All interactive elements keyboard accessible
- Proper ARIA labels for screen readers
- Color contrast ratios meeting AA standards
- Focus indicators on all interactive elements
- Charts include tabular data alternative

### NFR-4: Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### NFR-5: Mobile Responsiveness
- Full functionality on tablet (768px+)
- Optimized layout for mobile (< 768px)
- Touch-friendly controls
- Responsive charts

---

## UI/UX Specifications

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Page Header: "Dashboard" + Subtitle + Refresh Button        │
├─────────────────────────────────────────────────────────────┤
│ [Alert Banner] (if critical alerts exist)                   │
├─────────────────────────────────────────────────────────────┤
│ KPI Cards (4 columns on desktop, 2 on tablet, 1 on mobile) │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                   │
│ │Revenue│ │Orders │ │Products│ │Customers│                 │
│ └───────┘ └───────┘ └───────┘ └───────┘                   │
├─────────────────────────────────────────────────────────────┤
│ Charts Section (2 columns on desktop, 1 on mobile)         │
│ ┌─────────────────────┐ ┌─────────────────────┐           │
│ │  Revenue Chart       │ │  Orders Chart        │           │
│ │  (Line/Area)         │ │  (Bar/Donut)         │           │
│ └─────────────────────┘ └─────────────────────┘           │
├─────────────────────────────────────────────────────────────┤
│ Widgets Section (2 columns on desktop, 1 on mobile)        │
│ ┌─────────────────────┐ ┌─────────────────────┐           │
│ │  Top Products        │ │  Recent Orders       │           │
│ │  (List with images)  │ │  (Table)             │           │
│ └─────────────────────┘ └─────────────────────┘           │
├─────────────────────────────────────────────────────────────┤
│ Quick Actions (horizontal button group, centered)          │
└─────────────────────────────────────────────────────────────┘
```

### Color Coding
- **Revenue/Growth**: Green (#4caf50) for positive, Red (#f44336) for negative
- **Order Status**: 
  - Pending: Orange (#ff9800)
  - Processing: Blue (#2196f3)
  - Shipped: Purple (#9c27b0)
  - Delivered: Green (#4caf50)
  - Cancelled: Red (#f44336)
- **Alert Severity**:
  - Info: Blue (#2196f3)
  - Warning: Orange (#ff9800)
  - Critical: Red (#f44336)

### Typography
- **Page Title**: h4 (MUI Typography variant)
- **KPI Value**: h3, bold
- **KPI Label**: body2, secondary color
- **Chart Title**: h6
- **Widget Title**: h6, with action link on right
- **Table Headers**: subtitle2, uppercase

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create module structure
2. Implement API client functions
3. Build KPI cards component
4. Create hooks for data fetching
5. Basic layout and routing

### Phase 2: Data Visualization (Week 2)
1. Implement Revenue Chart
2. Implement Orders Chart
3. Add time period selectors
4. Implement responsive behavior

### Phase 3: Widgets & Actions (Week 3)
1. Build Top Products widget
2. Build Recent Orders widget
3. Implement Quick Actions panel
4. Add Alerts widget

### Phase 4: Polish & Optimization (Week 4)
1. Performance optimization
2. Error handling refinement
3. Accessibility audit and fixes
4. Loading state improvements
5. Unit and integration tests
6. Documentation

---

## Testing Requirements

### Unit Tests
- All hooks with mock data
- Individual components in isolation
- Utility functions
- API client functions

### Integration Tests
- Complete dashboard page load
- Permission-based rendering
- Refresh functionality
- Navigation to linked pages

### Performance Tests
- Lighthouse score > 90
- Bundle size analysis
- Large dataset handling

---

## Success Criteria

1. ✅ Dashboard loads in < 2 seconds
2. ✅ All KPIs display correctly with real data
3. ✅ Charts render smoothly with animations
4. ✅ Auto-refresh works without user interruption
5. ✅ Permission-based access control functional
6. ✅ Responsive design works on all target devices
7. ✅ WCAG 2.2 AA accessibility compliance
8. ✅ Zero console errors or warnings
9. ✅ TypeScript strict mode with no `any` types
10. ✅ Code passes ESLint without warnings
11. ✅ 80%+ test coverage

---

## Dependencies

### External Libraries
- `@mui/material` - UI components (already installed)
- `@mui/icons-material` - Icons (already installed)
- `@tanstack/react-query` - Data fetching (already installed)
- `react-router-dom` - Routing (already installed)
- `recharts` or `@mui/x-charts` - Chart library (to be added)
- `date-fns` - Date manipulation (to be added if needed)

### Internal Dependencies
- `src/api/client.ts` - API client
- `src/auth/useAuth.ts` - Authentication hook
- `src/theme.ts` - MUI theme
- `src/lib/format.ts` - Formatting utilities
- `src/components/PageHeader.tsx` - Page header component

---

## Future Enhancements (Post-MVP)

1. **Advanced Analytics**
   - Conversion funnel visualization
   - Customer cohort analysis
   - Product category performance
   - Geographic sales distribution

2. **Customization**
   - Drag-and-drop widget reordering
   - User-configurable KPIs
   - Custom date ranges
   - Saved dashboard views

3. **Predictive Insights**
   - Sales forecasting
   - Inventory recommendations
   - Churn prediction
   - Trend alerts

4. **Export Capabilities**
   - PDF report generation
   - Excel data export
   - Scheduled email reports

5. **Real-Time Notifications**
   - WebSocket integration
   - Push notifications
   - Live order feed

---

## Notes & Considerations

1. **Backend API Development**: This module requires new backend endpoints. Coordinate with backend team for API implementation following the same pattern as existing modules.

2. **Data Aggregation**: Dashboard queries can be expensive. Consider implementing:
   - Database views for common aggregations
   - Redis caching for KPI metrics
   - Background jobs for pre-calculation

3. **Menu Update**: After implementation, update menu navigation seed to change dashboard status from `coming_soon` to `available`.

4. **Navigation Registry**: Add `'dashboard'` to `navigation/routeRegistry.ts`.

5. **Route Guard**: Dashboard route should use existing `<RequireAuth />` component.

6. **Audit Logging**: Dashboard views don't require audit logs, but any actions triggered from quick actions should follow existing audit patterns.

---

## References

- BRD: Section on Admin Dashboard and Analytics
- Architecture Doc: `docs/ARCHITECTURE.md`
- Frontend README: Project structure and conventions
- Database Schema: `database/schema_all.sql`
- Existing Features: Products, Orders, Media modules as reference
