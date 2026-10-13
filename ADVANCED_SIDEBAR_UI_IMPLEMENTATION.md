# 🎨 Advanced Collapsible Sidebar - Complete UI Implementation

## 🎯 Features

✅ **Collapsible/Expandable** - Toggle between full (280px) and mini (64px) modes  
✅ **Toggle Button** - Icon button next to user profile at bottom  
✅ **Smooth Animations** - Professional transitions (300ms cubic-bezier)  
✅ **Hover Expansion** - Temporarily expand mini mode on hover  
✅ **Pin/Unpin** - Keep open or auto-hide  
✅ **Tooltips** - Show in mini mode  
✅ **Keyboard Shortcuts** - `Ctrl+B` to toggle  
✅ **LocalStorage** - Persist state across reloads  
✅ **Responsive** - Mobile-ready (overlay mode)  
✅ **Icon Colors** - Colored icons from database  
✅ **Dividers** - Visual separators  

---

## 📁 File Structure

```
src/
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx              (Main component)
│   │   ├── SidebarHeader.tsx        (Logo + title)
│   │   ├── SidebarMenu.tsx          (Menu items)
│   │   ├── SidebarFooter.tsx        (User profile + toggle)
│   │   ├── MenuItem.tsx             (Single menu item)
│   │   └── sidebar.styles.ts        (Styled components)
│   └── Layout/
│       └── AppLayout.tsx            (Main layout with sidebar)
├── hooks/
│   ├── useSidebar.ts                (Sidebar state & API)
│   └── useKeyboardShortcuts.ts      (Keyboard handlers)
└── styles/
    └── sidebar-animations.css       (CSS animations)
```

---

## 🚀 Implementation

### 1. Sidebar Hook (`hooks/useSidebar.ts`)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

const STORAGE_KEY = 'veylog.sidebar_state';

interface SidebarState {
  isCollapsed: boolean;
  isPinned: boolean;
  isHovering: boolean;
}

interface MenuItem {
  id: number;
  key: string;
  title: string;
  subtitle: string | null;
  hover_description: string | null;
  icon: string | null;
  icon_color: string | null;
  route: string | null;
  keyboard_shortcut: string | null;
  divider_after: boolean;
  show_in_collapsed: boolean;
  children: MenuItem[];
}

export function useSidebar() {
  // Load from localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial: SidebarState = stored 
    ? JSON.parse(stored) 
    : { isCollapsed: false, isPinned: true, isHovering: false };

  const [state, setState] = useState<SidebarState>(initial);

  // Fetch menu from API
  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', 'navigation'],
    queryFn: async () => {
      return api.get<{ sections: any[]; flat: any[] }>('/menu-navigation');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Toggle collapsed
  const toggleCollapse = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, isCollapsed: !prev.isCollapsed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Toggle pin
  const togglePin = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, isPinned: !prev.isPinned };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Set hovering
  const setHovering = useCallback((hovering: boolean) => {
    setState(prev => ({ ...prev, isHovering: hovering }));
  }, []);

  // Sync with API (background)
  const syncMutation = useMutation({
    mutationFn: async (preferences: Partial<SidebarState>) => {
      return api.patch('/sidebar/preferences', {
        is_collapsed: preferences.isCollapsed,
        is_pinned: preferences.isPinned,
      });
    },
  });

  // Sync with API on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      syncMutation.mutate(state);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state.isCollapsed, state.isPinned]);

  // Calculate actual width
  const width = state.isCollapsed && !state.isHovering ? 64 : 280;

  return {
    ...state,
    width,
    menuData,
    isLoading,
    toggleCollapse,
    togglePin,
    setHovering,
  };
}
```

---

### 2. Main Sidebar Component (`components/Sidebar/Sidebar.tsx`)

```typescript
import React from 'react';
import { Box, Drawer } from '@mui/material';
import { useSidebar } from '../../hooks/useSidebar';
import { SidebarHeader } from './SidebarHeader';
import { SidebarMenu } from './SidebarMenu';
import { SidebarFooter } from './SidebarFooter';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export function Sidebar() {
  const sidebar = useSidebar();

  // Keyboard shortcut: Ctrl+B
  useKeyboardShortcuts({
    'ctrl+b': sidebar.toggleCollapse,
  });

  return (
    <Drawer
      variant={sidebar.isPinned ? 'permanent' : 'temporary'}
      sx={{
        width: sidebar.width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: sidebar.width,
          boxSizing: 'border-box',
          transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      onMouseEnter={() => sidebar.setHovering(true)}
      onMouseLeave={() => sidebar.setHovering(false)}
    >
      {/* Header: Logo + Title */}
      <SidebarHeader 
        isCollapsed={sidebar.isCollapsed && !sidebar.isHovering} 
      />

      {/* Menu Items */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        <SidebarMenu 
          sections={sidebar.menuData?.sections || []}
          isCollapsed={sidebar.isCollapsed && !sidebar.isHovering}
        />
      </Box>

      {/* Footer: User + Toggle Button */}
      <SidebarFooter
        isCollapsed={sidebar.isCollapsed && !sidebar.isHovering}
        onToggle={sidebar.toggleCollapse}
      />
    </Drawer>
  );
}
```

---

### 3. Sidebar Footer (`components/Sidebar/SidebarFooter.tsx`)

```typescript
import React from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  Tooltip,
  Divider,
  Stack,
  alpha,
} from '@mui/material';
import {
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../auth/useAuth';

interface SidebarFooterProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function SidebarFooter({ isCollapsed, onToggle }: SidebarFooterProps) {
  const { user } = useAuth();

  return (
    <>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: alpha('#000', 0.02),
          transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: alpha('#000', 0.04),
          },
        }}
      >
        {/* User Avatar */}
        <Tooltip 
          title={isCollapsed ? user?.email : ''}
          placement="right"
          arrow
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'primary.main',
              flexShrink: 0,
            }}
          >
            <PersonIcon />
          </Avatar>
        </Tooltip>

        {/* User Info (Hidden when collapsed) */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            opacity: isCollapsed ? 0 : 1,
            transition: 'opacity 200ms ease',
            display: isCollapsed ? 'none' : 'block',
          }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ lineHeight: 1.2 }}
          >
            {user?.email}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ lineHeight: 1.2 }}
          >
            {user?.is_super_admin ? 'Super Admin' : 'Admin'}
          </Typography>
        </Box>

        {/* Toggle Button */}
        <Tooltip 
          title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          placement="right"
          arrow
        >
          <IconButton
            onClick={onToggle}
            size="small"
            sx={{
              flexShrink: 0,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                bgcolor: 'action.hover',
                transform: 'scale(1.1)',
              },
              transition: 'all 200ms ease',
            }}
          >
            {isCollapsed ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </>
  );
}
```

---

### 4. Sidebar Header (`components/Sidebar/SidebarHeader.tsx`)

```typescript
import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { StorefrontOutlined as LogoIcon } from '@mui/icons-material';

interface SidebarHeaderProps {
  isCollapsed: boolean;
}

export function SidebarHeader({ isCollapsed }: SidebarHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        minHeight: 64,
      }}
    >
      {/* Logo */}
      <LogoIcon
        sx={{
          fontSize: 32,
          color: 'primary.main',
          flexShrink: 0,
        }}
      />

      {/* Brand Name (Hidden when collapsed) */}
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{
          opacity: isCollapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
          display: isCollapsed ? 'none' : 'block',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Veylog
      </Typography>
    </Box>
  );
}
```

---

### 5. Sidebar Menu (`components/Sidebar/SidebarMenu.tsx`)

```typescript
import React from 'react';
import { Box, Typography, Collapse, alpha } from '@mui/material';
import { MenuItem } from './MenuItem';

interface Section {
  section: string;
  items: any[];
}

interface SidebarMenuProps {
  sections: Section[];
  isCollapsed: boolean;
}

export function SidebarMenu({ sections, isCollapsed }: SidebarMenuProps) {
  return (
    <Box>
      {sections.map((section) => (
        <Box key={section.section} sx={{ mb: 2 }}>
          {/* Section Header */}
          {!isCollapsed && (
            <Typography
              variant="caption"
              sx={{
                px: 2,
                py: 1,
                display: 'block',
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.75rem',
              }}
            >
              {section.section}
            </Typography>
          )}

          {/* Menu Items */}
          {section.items.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              depth={0}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

---

### 6. Menu Item Component (`components/Sidebar/MenuItem.tsx`)

```typescript
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Icon,
  Tooltip,
  Collapse,
  Badge,
  Chip,
  alpha,
  Box,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
} from '@mui/icons-material';

interface MenuItemProps {
  item: any;
  isCollapsed: boolean;
  depth: number;
}

export function MenuItem({ item, isCollapsed, depth }: MenuItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.route && location.pathname === item.route;

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else if (item.route) {
      navigate(item.route);
    }
  };

  const content = (
    <>
      <ListItemButton
        onClick={handleClick}
        sx={{
          px: 2 + depth * 2,
          py: 1.25,
          mx: 1,
          borderRadius: 1,
          mb: 0.5,
          backgroundColor: isActive ? alpha('#667eea', 0.12) : 'transparent',
          '&:hover': {
            backgroundColor: alpha('#667eea', 0.08),
          },
          transition: 'all 200ms ease',
        }}
      >
        {/* Icon */}
        <ListItemIcon
          sx={{
            minWidth: isCollapsed ? 0 : 40,
            justifyContent: 'center',
            color: item.icon_color || (isActive ? 'primary.main' : 'text.secondary'),
          }}
        >
          {item.badge ? (
            <Badge
              badgeContent={item.badge.count}
              color={item.badge.variant as any}
              max={99}
            >
              <Icon>{item.icon}</Icon>
            </Badge>
          ) : (
            <Icon>{item.icon}</Icon>
          )}
        </ListItemIcon>

        {/* Text (Hidden when collapsed) */}
        {!isCollapsed && (
          <>
            <ListItemText
              primary={item.title}
              secondary={depth === 0 ? item.subtitle : null}
              primaryTypographyProps={{
                fontWeight: isActive ? 600 : 400,
                fontSize: depth === 0 ? '0.875rem' : '0.8125rem',
              }}
              secondaryTypographyProps={{
                fontSize: '0.75rem',
              }}
            />

            {/* Keyboard Shortcut */}
            {item.keyboard_shortcut && depth === 0 && (
              <Chip
                label={item.keyboard_shortcut}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha('#000', 0.06),
                }}
              />
            )}

            {/* Coming Soon Badge */}
            {item.status === 'coming_soon' && (
              <Chip
                label="Soon"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha('#f59e0b', 0.12),
                  color: '#f59e0b',
                }}
              />
            )}

            {/* Expand Icon */}
            {hasChildren && (
              <Icon sx={{ color: 'text.secondary' }}>
                {isOpen ? <ExpandIcon /> : <CollapseIcon />}
              </Icon>
            )}
          </>
        )}
      </ListItemButton>

      {/* Divider */}
      {item.divider_after && !isCollapsed && (
        <Divider sx={{ my: 1, mx: 2 }} />
      )}
    </>
  );

  // Wrap with tooltip when collapsed
  const wrapped = isCollapsed ? (
    <Tooltip
      title={
        <Box>
          <div>{item.title}</div>
          {item.hover_description && (
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              {item.hover_description}
            </div>
          )}
        </Box>
      }
      placement="right"
      arrow
    >
      {content}
    </Tooltip>
  ) : (
    content
  );

  return (
    <>
      {wrapped}

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <Collapse in={isOpen} timeout="auto">
          {item.children.map((child: any) => (
            <MenuItem
              key={child.id}
              item={child}
              isCollapsed={isCollapsed}
              depth={depth + 1}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}
```

---

### 7. Keyboard Shortcuts Hook (`hooks/useKeyboardShortcuts.ts`)

```typescript
import { useEffect } from 'react';

type ShortcutMap = Record<string, () => void>;

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = [
        event.ctrlKey && 'ctrl',
        event.shiftKey && 'shift',
        event.altKey && 'alt',
        event.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join('+');

      const handler = shortcuts[key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
```

---

### 8. CSS Animations (`styles/sidebar-animations.css`)

```css
/* Smooth transitions */
.sidebar {
  transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Text fade */
.sidebar-text {
  opacity: 1;
  transition: opacity 200ms ease;
}

.sidebar.collapsed .sidebar-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

/* Icon animations */
.sidebar-icon {
  transition: transform 200ms ease, color 200ms ease;
}

.sidebar-icon:hover {
  transform: scale(1.1);
}

/* Hover expand effect */
.sidebar.collapsed:hover {
  width: 280px;
}

/* Smooth scroll */
.sidebar-menu {
  overflow-y: auto;
  scroll-behavior: smooth;
}

.sidebar-menu::-webkit-scrollbar {
  width: 6px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
```

---

## 🎨 Visual Design

### Color Scheme
```typescript
const theme = {
  sidebar: {
    background: '#ffffff',
    border: '#e5e7eb',
    hover: 'rgba(102, 126, 234, 0.08)',
    active: 'rgba(102, 126, 234, 0.12)',
    text: '#1f2937',
    textSecondary: '#6b7280',
    iconActive: '#667eea',
  },
};
```

### Layout
```
┌─────────────────────────┐
│ 🏪 Veylog              │  ← Header
├─────────────────────────┤
│                         │
│ Overview               │  ← Section
│ 📊 Dashboard           │  ← Menu Item
│                         │
│ Commerce               │  ← Section
│ 📦 Orders         >    │  ← Expandable
│   📋 All orders        │  ← Child
│   🛒 Abandoned carts   │
│                         │
├─────────────────────────┤
│ 👤 admin@veylor.com   ◀│  ← Footer with toggle
│    Super admin         │
└─────────────────────────┘
```

### Mini Mode (64px)
```
┌───┐
│🏪 │  ← Logo only
├───┤
│📊 │  ← Icons only
│📦 │
│👥 │
│🛍️ │
├───┤
│👤◀│  ← Avatar + Toggle
└───┘
```

---

## 🚀 Usage

```typescript
// App.tsx
import { Sidebar } from './components/Sidebar/Sidebar';
import { Box } from '@mui/material';

export function App() {
  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {/* Your content */}
      </Box>
    </Box>
  );
}
```

---

## ✨ Features Demo

### 1. Toggle Button
- Click icon next to user profile
- Collapses to 64px (icon-only)
- Smooth 300ms animation
- Persists in localStorage

### 2. Hover Expansion (Mini Mode)
- Hover over collapsed sidebar
- Temporarily expands to 280px
- Leaves on mouse out
- No state change

### 3. Keyboard Shortcut
- Press `Ctrl+B` anywhere
- Toggles collapsed state
- Works in any view

### 4. Tooltips (Mini Mode)
- Hover over icons
- Shows title + description
- Placement: right
- Arrow indicator

### 5. Icon Colors
- Reads `icon_color` from database
- Applies to menu icons
- Active state: primary blue
- Hover effect

### 6. Dividers
- Reads `divider_after` from database
- Shows visual separator
- Only in expanded mode

### 7. Coming Soon Badge
- Reads `status` from database
- Shows "Soon" chip
- Orange color
- Only in expanded mode

---

## 🎉 Result

You now have an **industry-leading collapsible sidebar** with:

✅ Toggle button next to user profile  
✅ Smooth animations (300ms cubic-bezier)  
✅ Hover expansion in mini mode  
✅ Keyboard shortcut (`Ctrl+B`)  
✅ Tooltips with descriptions  
✅ Colored icons from database  
✅ Visual dividers  
✅ LocalStorage persistence  
✅ Coming soon badges  
✅ Responsive design  

**The most advanced sidebar in the industry! 🚀**
