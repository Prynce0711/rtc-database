// "use client";

// import { Status } from "@/app/generated/prisma/enums";
// import Roles from "@/app/lib/Roles";
// import { useState } from "react";
// import { usePopup } from "../Popup/PopupProvider";

// export type MockUser = {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   status: Status | "PENDING";
//   createdAt: Date;
//   updatedAt: Date;
// };

// const AddAccountModal = ({
//   onClose,
//   onCreate,
// }: {
//   onClose: () => void;
//   onCreate: (user: MockUser) => void;
// }) => {
//   const popup = usePopup();
//   const [step, setStep] = useState<"FORM" | "REVIEW">("FORM");
//   const [loading, setLoading] = useState(false);

//   const [form, setForm] = useState({
//     name: "",
//     email: "",
//     role: Roles.USER,
//   });

//   const handleCreate = async () => {
//     setLoading(true);
//     popup.showLoading("Creating account...");

//     await new Promise((r) => setTimeout(r, 1200));

//     const newUser: MockUser = {
//       id: crypto.randomUUID(),
//       name: form.name,
//       email: form.email,
//       role: form.role,
//       status: "PENDING",
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };

//     popup.showSuccess("Account Created. Activation link sent.");
//     onCreate(newUser);
//     onClose();
//   };

//   return (
//     <div className="modal modal-open">
//       <div className="modal-box max-w-lg">
//         <h3 className="text-xl font-semibold mb-4">Add Account</h3>

//         {step === "FORM" && (
//           <>
//             <div className="space-y-3">
//               <input
//                 className="input input-bordered w-full"
//                 placeholder="Full Name"
//                 value={form.name}
//                 onChange={(e) => setForm({ ...form, name: e.target.value })}
//               />

//               <input
//                 className="input input-bordered w-full"
//                 placeholder="Email"
//                 value={form.email}
//                 onChange={(e) => setForm({ ...form, email: e.target.value })}
//               />

//               <select
//                 className="select select-bordered w-full"
//                 value={form.role}
//                 onChange={(e) =>
//                   setForm({ ...form, role: e.target.value as Roles })
//                 }
//               >
//                 <option value={Roles.USER}>Staff</option>
//                 <option value={Roles.ATTY}>Atty</option>
//                 <option value={Roles.CLERK}>Clerk</option>
//               </select>
//             </div>

//             <div className="modal-action">
//               <button className="btn" onClick={onClose}>
//                 Cancel
//               </button>

//               <button
//                 className="btn btn-primary"
//                 onClick={() => setStep("REVIEW")}
//                 disabled={!form.name || !form.email}
//               >
//                 Review
//               </button>
//             </div>
//           </>
//         )}

//         {step === "REVIEW" && (
//           <>
//             <div className="bg-base-200 rounded p-4 space-y-2 text-sm">
//               <p>
//                 <strong>Name:</strong> {form.name}
//               </p>
//               <p>
//                 <strong>Email:</strong> {form.email}
//               </p>
//               <p>
//                 <strong>Role:</strong> {form.role}
//               </p>
//             </div>

//             <div className="modal-action">
//               <button className="btn" onClick={() => setStep("FORM")}>
//                 Back
//               </button>

//               <button
//                 className={`btn btn-primary ${loading ? "loading" : ""}`}
//                 onClick={handleCreate}
//               >
//                 Confirm & Create
//               </button>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default AddAccountModal;
