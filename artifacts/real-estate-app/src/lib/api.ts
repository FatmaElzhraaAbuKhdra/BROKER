const BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  },
};

// ---- Types ----
export interface User {
  USER_ID: number;
  USERNAME: string;
  FULL_NAME: string;
  EMAIL: string;
  ROLE: "ADMIN" | "ACCOUNTING";
  IS_ACTIVE: number;
  CREATED_DATE: string;
}

export interface UnitType {
  TYPE_ID: number;
  TYPE_NAME: string;
  DESCRIPTION: string;
  CREATED_DATE: string;
}

export interface Project {
  PROJECT_ID: number;
  PROJECT_NAME: string;
  LOCATION: string;
  DESCRIPTION: string;
  START_DATE: string;
  END_DATE: string;
  STATUS: "ACTIVE" | "COMPLETED" | "ON_HOLD";
  CREATED_DATE: string;
}

export interface Building {
  BUILDING_ID: number;
  PROJECT_ID: number;
  BUILDING_NAME: string;
  BUILDING_CODE: string;
  FLOORS_COUNT: number;
  LAND_AREA: number | null;
  TOTAL_SALEABLE_AREA: number | null;
  DESCRIPTION: string;
  PROJECT_NAME: string;
  CREATED_DATE: string;
}

export interface Floor {
  FLOOR_ID: number;
  BUILDING_ID: number;
  FLOOR_NUMBER: string;
  FLOOR_NAME: string;
  FLOOR_TYPE: string | null;
  DESCRIPTION: string;
  BUILDING_NAME: string;
  PROJECT_NAME: string;
}

export interface Customer {
  CUSTOMER_ID: number;
  FULL_NAME: string;
  MOBILE: string;
  EMAIL: string;
  NATIONAL_ID: string;
  ADDRESS: string;
  NOTES: string;
  CREATED_DATE: string;
}

export interface Unit {
  UNIT_ID: number;
  UNIT_CODE: string;
  UNIT_NAME: string;
  TYPE_ID: number;
  PROJECT_ID: number;
  BUILDING_ID: number;
  FLOOR_ID: number;
  AREA: number;
  SALEABLE_AREA: number | null;
  ROOMS: number;
  BATHROOMS: number;
  PRICE: number;
  STATUS: "AVAILABLE" | "SOLD" | "RESERVED";
  DESCRIPTION: string;
  TYPE_NAME: string;
  PROJECT_NAME: string;
  BUILDING_NAME: string;
  FLOOR_NUMBER: string;
  FLOOR_NAME: string;
  FLOOR_TYPE: string | null;
  IMAGES?: UnitImage[];
  CREATED_DATE: string;
}

export interface UnitImage {
  IMAGE_ID: number;
  UNIT_ID: number;
  FILE_NAME: string;
  FILE_PATH: string;
  MIME_TYPE: string;
  FILE_SIZE: number;
  IS_PRIMARY: number;
  CREATED_DATE: string;
}

export interface Sale {
  SALE_ID: number;
  UNIT_ID: number;
  CUSTOMER_ID: number;
  SALE_DATE: string;
  SALE_AMOUNT: number;
  NOTES: string;
  UNIT_CODE: string;
  UNIT_NAME: string;
  UNIT_PRICE: number;
  CUSTOMER_NAME: string;
  CUSTOMER_MOBILE: string;
  PROJECT_NAME: string;
  CREATED_DATE: string;
}

export interface DashboardKpis {
  totalUnits: number;
  soldUnits: number;
  availableUnits: number;
  totalSalesValue: number;
  recentSales: RecentSale[];
}

export interface RecentSale {
  SALE_ID: number;
  UNIT_CODE: string;
  UNIT_NAME: string;
  CUSTOMER_NAME: string;
  SALE_AMOUNT: number;
  SALE_DATE: string;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("ar-SA");
  } catch {
    return String(date);
  }
}
