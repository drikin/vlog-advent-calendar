"use client";

import dynamic from "next/dynamic";

const VlogCalendarClient = dynamic(
  () => import("./VlogCalendarClient"),
  { ssr: false }
);

export default VlogCalendarClient;
