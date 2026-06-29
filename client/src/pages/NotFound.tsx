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
    <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: "#FAF9F5" }}>
      <Card className="w-full max-w-lg mx-4 border" style={{ boxShadow: "0 4px 20px rgba(11,27,36,0.08)", borderColor: "#E2EAED" }}>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#EEF5F7" }}
            >
              <AlertCircle className="h-8 w-8" style={{ color: "#1C3A48" }} />
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-2" style={{ color: "#1C3A48" }}>404</h1>

          <h2 className="text-xl font-semibold mb-4" style={{ color: "#3E5560" }}>
            Page Not Found
          </h2>

          <p className="mb-8 leading-relaxed" style={{ color: "#7A9BA6" }}>
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
              style={{ backgroundColor: "#1C3A48" }}
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
