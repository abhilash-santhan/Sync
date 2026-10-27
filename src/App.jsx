
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import CollaborationDashboard from "./CollaborationDashboard";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import CompanyDashboard from "./CompanyDashboard";

export default function App() {
  const path = window.location.pathname;

  if (path === "/admin/login") {
    return <AdminLogin />;
  }

  if (path === "/admin/dashboard") {
    return <AdminDashboard />;
  }

  if (path === "/signup") {
    return <Signup />;
  }

  if (path === "/company/dashboard") {
    return <CompanyDashboard />;
  }

  if (path === "/dashboard") {
    return <Dashboard />;
  }

  if (path.startsWith("/collaboration/")) {
    const projectId = decodeURIComponent(path.split("/")[2] || "");

    if (!projectId) {
      return <Dashboard />;
    }

    return <CollaborationDashboard projectId={projectId} />;
  }

  return <Login />;
}
