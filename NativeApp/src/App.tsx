"use client";

import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./Login";
import TestApp from "./TestApp";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/test" element={<TestApp />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
