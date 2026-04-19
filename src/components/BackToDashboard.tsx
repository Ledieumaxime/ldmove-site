import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const BackToDashboard = () => (
  <Link
    to="/app/home"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft size={16} /> Dashboard
  </Link>
);

export default BackToDashboard;
