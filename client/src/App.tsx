import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { MenuPage } from "./components/Menu/MenuPage";
import { CheckoutPage } from "./components/Checkout/CheckoutPage";
import { OrderConfirmationPage } from "./components/Orders/OrderConfirmationPage";
import { OrderStatusPage } from "./components/Orders/OrderStatusPage";
import { OrderHistoryPage } from "./components/Orders/OrderHistoryPage";
import { AuthModal } from "./components/Auth/AuthModal";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { SlotCapacityPage } from "./components/Admin/SlotCapacityPage";
import { MenuAdminPage } from "./components/Admin/Menu/MenuAdminPage";
import { OrdersPage } from "./components/Admin/OrdersPage";

function CartPage() {
  return <div style={{ padding: "16px" }}>Cart</div>;
}

function AppRoutes() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setShowAuthModal(true);
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  return (
    <>
      {showAuthModal && (
        <AuthModal
          onSuccess={() => setShowAuthModal(false)}
          onGuest={() => {
            setShowAuthModal(false);
            navigate("/menu");
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/orders/:id" element={<OrderStatusPage />} />
        <Route path="/orders/history" element={<OrderHistoryPage />} />
        <Route path="/admin/slots" element={<SlotCapacityPage />} />
        <Route path="/admin/menu" element={<MenuAdminPage />} />
        <Route path="/admin/orders" element={<OrdersPage />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Layout>
            <AppRoutes />
          </Layout>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
