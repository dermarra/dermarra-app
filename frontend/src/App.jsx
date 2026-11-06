import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Footer from "./components/Footer.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ButterflyCursor from "./components/ButterflyCursor.jsx";

import Home from "./pages/Home.jsx";
import Shop from "./pages/Shop.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import ConcernShop from "./pages/ConcernShop.jsx";
import IngredientShop from "./pages/IngredientShop.jsx";
import StepShop from "./pages/StepShop.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import RoutineQuiz from "./pages/RoutineQuiz.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AccountLayout from "./pages/account/AccountLayout.jsx";
import AccountProfile from "./pages/account/AccountProfile.jsx";
import AccountRoutines from "./pages/account/AccountRoutines.jsx";
import AccountWishlist from "./pages/account/AccountWishlist.jsx";
import AccountOrders from "./pages/account/AccountOrders.jsx";
import AccountOrderDetail from "./pages/account/AccountOrderDetail.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminHeroSlides from "./pages/admin/AdminHeroSlides.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
import AdminInventory from "./pages/admin/AdminInventory.jsx";
import AdminInventoryDetail from "./pages/admin/AdminInventoryDetail.jsx";
import AdminRoutines from "./pages/admin/AdminRoutines.jsx";
import AdminConcerns from "./pages/admin/AdminConcerns.jsx";
import AdminIngredients from "./pages/admin/AdminIngredients.jsx";
import AdminStepGroups from "./pages/admin/AdminStepGroups.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminCoupons from "./pages/admin/AdminCoupons.jsx";
import AdminRoles from "./pages/admin/AdminRoles.jsx";
import AdminActivity from "./pages/admin/AdminActivity.jsx";
import RequirePermission, { AdminHome } from "./components/admin/RequirePermission.jsx";

export default function App() {
  const location = useLocation();
  // The admin area is its own app shell (sidebar + top bar, see
  // AdminLayout.jsx) -- the storefront navbar/footer/bottom-nav don't show.
  const isAdmin = location.pathname.startsWith("/admin");
  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <Navbar />}
      <main className={`flex-1 ${isAdmin ? "" : "pb-safe-nav sm:pb-0"}`}>
        <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/concern/:slug" element={<ConcernShop />} />
          <Route path="/shop/ingredient/:slug" element={<IngredientShop />} />
          <Route path="/shop/step/:key" element={<StepShop />} />
          <Route path="/shop/:slug" element={<ProductDetail />} />
          <Route path="/quiz" element={<RoutineQuiz />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<AccountProfile />} />
            <Route path="routines" element={<AccountRoutines />} />
            <Route path="wishlist" element={<AccountWishlist />} />
            <Route path="orders" element={<AccountOrders />} />
            <Route path="orders/:orderId" element={<AccountOrderDetail />} />
          </Route>

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="dashboard" element={<RequirePermission page="dashboard"><AdminDashboard /></RequirePermission>} />
            <Route path="hero-slides" element={<RequirePermission page="hero-slides"><AdminHeroSlides /></RequirePermission>} />
            <Route path="orders" element={<RequirePermission page="orders"><AdminOrders /></RequirePermission>} />
            <Route path="orders/:orderId" element={<RequirePermission page="orders"><AdminOrderDetail /></RequirePermission>} />
            <Route path="products" element={<RequirePermission page="products"><AdminProducts /></RequirePermission>} />
            <Route path="inventory" element={<RequirePermission page="inventory"><AdminInventory /></RequirePermission>} />
            <Route path="inventory/:variantId" element={<RequirePermission page="inventory"><AdminInventoryDetail /></RequirePermission>} />
            <Route path="routines" element={<RequirePermission page="routines"><AdminRoutines /></RequirePermission>} />
            <Route path="concerns" element={<RequirePermission page="concerns"><AdminConcerns /></RequirePermission>} />
            <Route path="ingredients" element={<RequirePermission page="ingredients"><AdminIngredients /></RequirePermission>} />
            <Route path="step-groups" element={<RequirePermission page="step-groups"><AdminStepGroups /></RequirePermission>} />
            <Route path="users" element={<RequirePermission page="users"><AdminUsers /></RequirePermission>} />
            <Route path="coupons" element={<RequirePermission page="coupons"><AdminCoupons /></RequirePermission>} />
            <Route path="roles" element={<RequirePermission page="roles"><AdminRoles /></RequirePermission>} />
            <Route path="activity" element={<RequirePermission page="activity"><AdminActivity /></RequirePermission>} />
          </Route>
        </Routes>
        </ErrorBoundary>
        {!isAdmin && <Footer />}
      </main>
      {!isAdmin && <BottomNav />}
      {!isAdmin && <ButterflyCursor />}
    </div>
  );
}
