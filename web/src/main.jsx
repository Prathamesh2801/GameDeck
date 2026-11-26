import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Toaster } from "react-hot-toast";
import "./index.css";
import Login from "./admin/Login.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";
import Decks from "./admin/Decks.jsx";
import DeckScores from "./admin/DeckScores.jsx";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/admin" replace /> },
  { path: "/admin/login", element: <Login /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Decks /> },
      { path: "decks/:id", element: <DeckScores /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster position="bottom-center" toastOptions={{ style: { fontSize: "0.875rem" } }} />
  </StrictMode>,
);
