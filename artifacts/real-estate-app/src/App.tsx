import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Units from "@/pages/Units";
import UnitDetails from "@/pages/UnitDetails";
import UnitForm from "@/pages/UnitForm";
import UnitTypes from "@/pages/UnitTypes";
import Buildings from "@/pages/Buildings";
import Floors from "@/pages/Floors";
import Customers from "@/pages/Customers";
import Sales from "@/pages/Sales";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#1b6ca8]">جارٍ التحميل...</div>;
  if (!user) return <Redirect to="/login" />;
  return <AppLayout><Component /></AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/units" component={() => <ProtectedRoute component={Units} />} />
      <Route path="/units/new" component={() => <ProtectedRoute component={UnitForm} />} />
      <Route path="/units/:id/edit" component={() => <ProtectedRoute component={UnitForm} />} />
      <Route path="/units/:id" component={() => <ProtectedRoute component={UnitDetails} />} />
      <Route path="/unit-types" component={() => <ProtectedRoute component={UnitTypes} />} />
      <Route path="/buildings" component={() => <ProtectedRoute component={Buildings} />} />
      <Route path="/floors" component={() => <ProtectedRoute component={Floors} />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} />} />
      <Route path="/sales" component={() => <ProtectedRoute component={Sales} />} />
      <Route component={() => <Redirect to="/dashboard" />} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors closeButton duration={3000} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
