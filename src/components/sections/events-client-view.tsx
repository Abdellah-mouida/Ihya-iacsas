"use client";

import { useState } from "react";

import { EventsHeader, type EventFilterType } from "@/components/sections/events-header";
import { OpenEvents } from "@/components/sections/open-events";
import { PastEvents } from "@/components/sections/past-events";
import rbStyles from "@/components/common/react-bits-adaptations.module.css";

export function EventsClientView() {
  const [filter, setFilter] = useState<EventFilterType>("all");

  return (
    <div data-rb="AnimatedContent" className={rbStyles.animatedContent}>
      <div data-rb="SpotlightCard" className={rbStyles.spotlightSurface}>
        <EventsHeader filter={filter} onFilterChange={setFilter} />
        {(filter === "all" || filter === "open") && <OpenEvents />}
        {(filter === "all" || filter === "past") && <PastEvents />}
      </div>
    </div>
  );
}
