import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuth } from '../features/auth/AuthContext';
import {
  AppShell,
  NavLink,
  Button,
  Group,
  Text,
  Drawer,
  Stack,
  Box,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconMenu2,
  IconHome,
  IconFileCheck,
  IconPlus,
  IconLogout,
  IconLayoutDashboard
} from '@tabler/icons-react';
import { JSX } from 'preact';

// Custom collapse icon: three bars with left chevron
function CollapseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {/* Three horizontal bars */}
      <rect x="2" y="5" width="10" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="11" width="10" height="2" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="2" y="17" width="10" height="2" rx="1" fill="currentColor" />
      {/* Left chevron */}
      <path
        d="M16 8L12 12L16 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}

interface SideMenuProps {
  children: JSX.Element;
}

export function SideMenu({ children }: SideMenuProps) {
  const { userData, logout } = useAuth();
  const location = useLocation();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleLogout = async () => {
    try {
      await logout();
      location.route('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const getMenuItems = () => {
    const items = [];
    
    if (userData?.role === 'admin') {
      items.push({ label: 'Dashboard', path: '/', icon: IconLayoutDashboard });
    }

    // Both roles can see "Mis Reportes"
    items.push({ label: 'Mis Reportes', path: '/mis-reportes', icon: IconFileCheck });

    return items;
  };

  const menuItems = getMenuItems();

  const handleNavClick = (path: string) => {
    location.route(path);
    if (isMobile) {
      close();
    }
  };

  const navContent = (
    <Stack gap="md" style={{ height: '100%' }}>
      {/* Header with title and toggle */}
      <Group p="md" wrap="nowrap" align="center" justify={collapsed ? 'center' : 'space-between'}>
        {(!collapsed || isMobile) && (
          <Text fw={700} size="lg" ta="center" style={{ flex: 1, lineHeight: 1.2 }}>
            Site Survey
          </Text>
        )}
        {!isMobile && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            p={collapsed ? 4 : 'xs'}
          >
            {collapsed ? <IconMenu2 size={18} /> : <CollapseIcon size={18} />}
          </Button>
        )}
      </Group>

      {/* Nuevo reporte button */}
      <Box px="md">
        <Button
          fullWidth
          leftSection={!collapsed && <IconPlus size={18} />}
          variant="light"
          onClick={() => handleNavClick('/mis-reportes')} // Simply go to mis-reportes to handle new there
          title={collapsed ? "Nuevo Reporte" : undefined}
        >
          {collapsed ? <IconPlus size={18} /> : 'Nuevo reporte'}
        </Button>
      </Box>

      {/* Navigation items */}
      <Stack gap={0} style={{ flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.path === item.path || (item.path === '/' && location.path === '/');

          return (
            <NavLink
              key={item.path}
              href={item.path}
              label={collapsed ? undefined : item.label}
              leftSection={<Icon size={18} />}
              active={isActive}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                handleNavClick(item.path);
              }}
              style={{
                paddingLeft: collapsed ? '0.75rem' : '1rem',
                paddingRight: collapsed ? '0.75rem' : '1rem',
              }}
            />
          );
        })}
      </Stack>

      {/* User info */}
      {userData && (
        <Box px="md" pb="xs" style={{ textAlign: collapsed ? 'center' : 'left' }}>
          {collapsed ? (
            <Text size="xs" c="dimmed" title={userData.full_name}>
              {userData.full_name.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <>
              <Text size="sm" fw={500} truncate>
                {userData.full_name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {userData.email}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {userData.role === 'admin' ? 'Administrador' : 'Trabajador'}
              </Text>
              {userData.role === 'field_worker' && (
                <Text size="xs" c="dimmed" truncate tt="capitalize">
                  {userData.group_assignment.replace('_', ' ')}
                </Text>
              )}
            </>
          )}
        </Box>
      )}

      {/* Cerrar sesión button */}
      <Box px="md" pb="md">
        <Button
          fullWidth
          leftSection={!collapsed && <IconLogout size={18} />}
          variant="light"
          color="red"
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          {collapsed ? <IconLogout size={18} /> : 'Cerrar sesión'}
        </Button>
      </Box>
    </Stack>
  );

  if (isMobile) {
    return (
      <AppShell
        header={{ height: 60 }}
        padding="md"
      >
        <AppShell.Header>
            <Group h="100%" px="md" justify="space-between">
                <Group>
                    <Button variant="subtle" size="sm" onClick={toggle} p={0}>
                        <IconMenu2 size={20} />
                    </Button>
                    <Text fw={700} size="lg">
                        Site Survey
                    </Text>
                </Group>
            </Group>
        </AppShell.Header>

        <AppShell.Main>{children}</AppShell.Main>

        <Drawer
          opened={opened}
          onClose={close}
          position="left"
          size="75%" 
          withCloseButton={false}
          styles={{
            body: { padding: 0 },
            content: { height: '100%' },
          }}
        >
          {navContent}
        </Drawer>
      </AppShell>
    );
  }

  return (
    <AppShell
      navbar={{
        width: collapsed ? 80 : 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Navbar p={0}>{navContent}</AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
