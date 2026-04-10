import { Routes, Route, Navigate } from 'react-router-dom';

import LoginScreen from '../features/auth/LoginScreenModern';
import MenuScreen from '../features/menu/MenuScreen';
import ProcessContainer from '../features/process/ProcessContainer';
import DataMenu from '../features/data/DataMenuModern';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import ProductsPanel from '../features/data/ProductPanelV2';
import StockPanel from '../features/data/StockPanelV2';
import PricesPanel from '../features/data/PricesPanelV2';
import WarehouseMapPanel from '../features/data/WarehouseMapPanelV2';
import CorrectionsPanel from '../features/data/CorrectionsPanel';
import InventoryHistory from '../features/history/InventoryHistoryModern';
import Dashboard from '../features/dashboard/DashboardScreen';
import UserPanel from '../features/admin/UserPanel';

export default function AppRoutes() {
  return (
    <Routes>
      {/* 🔓 PUBLIC */}
      <Route path="/login" element={<LoginScreen />} />

      {/* 🔐 MENU */}
      <Route
        path="/menu"
        element={
          <ProtectedRoute>
            <MenuScreen />
          </ProtectedRoute>
        }
      />

      {/* 🔐 PROCESS */}
      <Route
        path="/process"
        element={
          <ProtectedRoute>
            <RoleRoute
              permission="process"
            >
              <ProcessContainer />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

            {/* 🔐 DATA */}
      <Route
        path="/data"
        element={
          <ProtectedRoute>
            <RoleRoute permission="data">
              <DataMenu />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

            <Route
        path="/data/products"
        element={
          <ProtectedRoute>
            <RoleRoute permission="data">
              <ProductsPanel />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
  path="/data/stock"
  element={
    <ProtectedRoute>
      <RoleRoute permission="data">
        <StockPanel />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/data/prices"
  element={
    <ProtectedRoute>
      <RoleRoute permission="data">
        <PricesPanel />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/data/locations"
  element={
    <ProtectedRoute>
      <RoleRoute permission="data">
        <WarehouseMapPanel />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/data/history"
  element={
    <ProtectedRoute>
      <RoleRoute permission="data">
        <CorrectionsPanel />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/history"
  element={
    <ProtectedRoute>
      <RoleRoute permission="history">
        <InventoryHistory />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/data/corrections"
  element={
    <ProtectedRoute>
      <RoleRoute permission="data">
        <CorrectionsPanel />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <RoleRoute permission="dashboard">
        <Dashboard />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

<Route
  path="/admin"
  element={
    <ProtectedRoute>
      <RoleRoute permission="admin">
        <UserPanel />
      </RoleRoute>
    </ProtectedRoute>
  }
/>

      {/* 🔁 DEFAULT */}
  <Route path="/" element={<Navigate to="/menu" replace />}/>
 <Route path="*" element={<Navigate to="/login" replace />}/>
    </Routes>
  );
}
