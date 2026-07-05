declare module "react-big-calendar" {
  import type { ComponentType } from "react";

  export const Calendar: ComponentType<any>;
  export const Views: { MONTH: "month"; WEEK: "week"; DAY: "day"; AGENDA: "agenda" };
  export const Navigate: { PREVIOUS: "PREV"; NEXT: "NEXT"; TODAY: "TODAY"; DATE: "DATE" };
  export const dateFnsLocalizer: (config: any) => any;
  export type View = "month" | "week" | "day" | "agenda" | "work_week";
}

declare module "react-big-calendar/lib/addons/dragAndDrop" {
  import type { ComponentType } from "react";
  const withDragAndDrop: (component: ComponentType<any>) => ComponentType<any>;
  export default withDragAndDrop;
}
