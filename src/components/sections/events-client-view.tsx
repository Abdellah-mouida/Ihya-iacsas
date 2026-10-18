"use client";

import { useState } from "react";

import { EventsHeader, type EventFilterType } from "@/components/sections/events-header";
import { OpenEvents } from "@/components/sections/open-events";
import { PastEvents } from "@/components/sections/past-events";

export function EventsClientView() {
  const [filter, setFilter] = useState<EventFilterType>("all");

  return (
    <>
      <EventsHeader filter={filter} onFilterChange={setFilter} />
      {(filter === "all" || filter === "open") && <OpenEvents />}
      {(filter === "all" || filter === "past") && <PastEvents />}
    </>
  );
}
