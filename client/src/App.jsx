import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./components/AppShell.jsx";
import Landing from "./pages/Landing.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Category from "./pages/Category.jsx";
import Profile from "./pages/Profile.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MealPlan from "./pages/MealPlan.jsx";
import Scanner from "./pages/Scanner.jsx";
import Assistant from "./pages/Assistant.jsx";
import Reports from "./pages/Reports.jsx";
import Consult from "./pages/Consult.jsx";
import Pricing from "./pages/Pricing.jsx";
import Account from "./pages/Account.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";
import FoodsAdmin from "./admin/FoodsAdmin.jsx";
import RulesAdmin from "./admin/RulesAdmin.jsx";
import RamadanAdmin from "./admin/RamadanAdmin.jsx";
import DietitianHome from "./pages/dietitian/DietitianHome.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/category" element={<Category />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route element={<ProtectedRoute requireProfile />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/plan" element={<MealPlan />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/consult" element={<Consult />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<FoodsAdmin />} />
          <Route path="foods" element={<FoodsAdmin />} />
          <Route path="rules" element={<RulesAdmin />} />
          <Route path="ramadan" element={<RamadanAdmin />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={["dietitian"]} />}>
        <Route path="/dietitian" element={<DietitianHome />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
