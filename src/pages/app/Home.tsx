import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/pages/app/admin/AdminDashboard";
import ClientDashboard from "@/pages/app/ClientDashboard";

const Home = () => {
  const { profile } = useAuth();
  if (profile?.role === "coach") return <AdminDashboard />;
  return <ClientDashboard />;
};

export default Home;
