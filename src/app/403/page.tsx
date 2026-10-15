import React from "react";
import { ForbiddenView } from "@/components/pages/forbidden-view";

export const metadata = {
  title: "403 - Forbidden | برنامج إحياء",
  description: "Access forbidden / الدخول غير مصرح به",
};

export default function ForbiddenPage() {
  return <ForbiddenView />;
}
