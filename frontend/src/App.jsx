import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import AdminRoute from "./components/AdminRoute.jsx";

import Home from "./pages/Home.jsx";
import Shop from "./pages/Shop.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import RoutineQuiz from "./pages/RoutineQuiz.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Account from "./pages/Account.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
import AdminRoutines from "./pages/admin/AdminRoutines.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pb-safe-nav sm:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:slug" element={<ProductDetail />} />
          <Route path="/quiz" element={<RoutineQuiz />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/account" element={<Account />} />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:orderId" element={<AdminOrderDetail />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="routines" element={<AdminRoutines />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
