import axios from "axios";

// Plain client for public pages (/pay, /book) — no auth store, no silent
// refresh, no Authorization header. These pages are never logged in.
export const publicApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : "http://localhost:3001/api",
});
