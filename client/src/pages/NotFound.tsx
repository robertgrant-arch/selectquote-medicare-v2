import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: "#F9F9F9" }}>
      <Card className="w-full max-w-lg mx-4 border" style={{ boxShadow: "0 4px 20px rgba(11,27,36,0.08)", borderColor: "#E8E8E8" }}>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#E6F7F9" }}
            >
              <AlertCircle className="h-8 w-8" style={{ color: "#00353E" }} />
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-2" style={{ color: "#00353E" }}>404</h1>

          <h2 className="text-xl font-semibold mb-4" style={{ color: "#303030" }}>
            Page Not Found
          </h2>

          <p className="mb-8 leading-relaxed" style={{ color: "#8C8C8C" }}>
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="text-white px-6 py-2.5 rounded-lg transition-all duration-200"
              style={{ backgroundColor: "#00353E" }}
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
