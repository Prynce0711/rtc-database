// "use client";

// import { authClient } from "@/app/lib/authClient";
// import { useRouter } from "next/navigation";

// const Header = () => {
//   const router = useRouter();

//   async function handleSignOut() {
//     await authClient.signOut({
//       fetchOptions: {
//         onSuccess: () => router.push("/"),
//       },
//     });
//   }

//   return (
//     <header className="sticky top-0 z-40 bg-base-100 border-b border-base-200">
//       <div className="h-16 px-4 flex items-center justify-between">
//         {/* LEFT – Mobile sidebar toggle */}
//         <label
//           htmlFor="my-drawer-4"
//           className="btn btn-ghost btn-sm lg:hidden"
//           aria-label="Open sidebar"
//         >
//           ☰
//         </label>

//         {/* CENTER – Page title handled by content */}

//         {/* RIGHT – Actions */}
//         <div className="flex items-center gap-2">
//           <button onClick={handleSignOut} className="btn btn-sm btn-outline">
//             Logout
//           </button>
//         </div>
//       </div>
//     </header>
//   );
// };

// export default Header;
