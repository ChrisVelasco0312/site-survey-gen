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
  IconX,
  IconHome,
  IconFileCheck,
  IconCheck,
  IconPlus,
  IconLogout,
  IconChevronLeft,
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
  const { user, logout } = useAuth();
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

  const menuItems = [
    { label: 'Mis sitios', path: '/mis-sitios', icon: IconHome },
    { label: 'En revisión', path: '/en-revision', icon: IconFileCheck },
    { label: 'Generados', path: '/generados', icon: IconCheck },
  ];

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
        {!collapsed && (
          <Text fw={700} size="lg" ta="center" style={{ flex: 1, lineHeight: 1.2 }}>
            Generador Site Survey
          </Text>
        )}
        {!isMobile && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <IconMenu2 size={18} /> : <CollapseIcon size={18} />}
          </Button>
        )}
        {isMobile && (
          <Button
            variant="subtle"
            size="sm"
            onClick={close}
          >
            <CollapseIcon size={18} />
          </Button>
        )}
      </Group>

      {/* Nuevo sitio button */}
      <Box px="md">
        <Button
          fullWidth
          leftSection={!collapsed && <IconPlus size={18} />}
          variant="light"
          onClick={() => handleNavClick('/mis-sitios')}
        >
          {collapsed ? <IconPlus size={18} /> : 'Nuevo sitio'}
        </Button>
      </Box>

      {/* Navigation items */}
      <Stack gap={0} style={{ flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.path === item.path;

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

      {/* Cerrar sesión button */}
      <Box px="md" pb="md">
        <Button
          fullWidth
          leftSection={!collapsed && <IconLogout size={18} />}
          variant="light"
          color="red"
          onClick={handleLogout}
        >
          {collapsed ? <IconLogout size={18} /> : 'Cerrar sesión'}
        </Button>
      </Box>
    </Stack>
  );

  if (isMobile) {
    return (
      <>
        <AppShell
          header={{ height: 60 }}
          padding="md"
        >
          <AppShell.Header>
            <Group h="100%">
              <Button variant="subtle" size="sm" onClick={toggle}>
                <IconMenu2 size={20} />
              </Button>
              <Text fw={700} size="lg">
                Generador Site Survey
              </Text>
            </Group>
          </AppShell.Header>

          <AppShell.Main>{children}</AppShell.Main>

          <Drawer
            opened={opened}
            onClose={close}
            position="left"
            size="100%"
            withCloseButton={false}
            styles={{
              body: { padding: 0 },
              content: { height: '100%' },
            }}
          >
            {navContent}
          </Drawer>
        </AppShell>
      </>
    );
  }

  return (
    <AppShell
      navbar={{
        width: collapsed ? 80 : 280,
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
