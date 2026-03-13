// "use client";

// import { BarChart3, FileText, Gavel, Scale } from "lucide-react";
// import React from "react";

// type KPIKey = "totalCriminal" | "totalCivil" | "grandTotal" | "branches";

// interface MonthlyKPIProps {
//   totalCriminal: number;
//   totalCivil: number;
//   grandTotal: number;
//   branches: number;
//   icons?: Partial<Record<KPIKey, React.ComponentType<any>>>;
// }

// const cards = [
//   {
//     label: "Branches",
//     key: "branches" as const,
//     subtitle: "Active branches",
//     icon: FileText,
//     color: "black",
//     delay: 300,
//   },
//   {
//     label: "Criminal",
//     key: "totalCriminal" as const,
//     subtitle: "Total criminal cases",
//     icon: Gavel,
//     color: "black",
//     delay: 0,
//   },
//   {
//     label: "Civil",
//     key: "totalCivil" as const,
//     subtitle: "Total civil cases",
//     icon: Scale,
//     color: "black",
//     delay: 100,
//   },
//   {
//     label: "Grand Total",
//     key: "grandTotal" as const,
//     subtitle: "All cases combined",
//     icon: BarChart3,
//     color: "black",
//     delay: 200,
//   },
// ];

// const MonthlyKPI: React.FC<MonthlyKPIProps> = (props) => {
//   return (
//     <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
//       {cards.map((card, idx) => {
//         const isGrand = card.key === "grandTotal";
//         const outerClass = isGrand
//           ? "transform hover:scale-105 card bg-primary/10 shadow-lg hover:shadow-xl transition-shadow ring-1 ring-primary/20 group"
//           : "transform hover:scale-105 card surface-card-hover group";

//         const labelClass = isGrand
//           ? "font-extrabold uppercase text-sm tracking-wide text-primary/70 mb-3"
//           : "font-extrabold uppercase text-sm tracking-wide text-base-content mb-3";

//         const numberClass = isGrand
//           ? "text-4xl sm:text-5xl font-black text-primary mb-2"
//           : "text-4xl sm:text-5xl font-black text-base-content mb-2";

//         const subtitleClass = isGrand
//           ? "text-sm sm:text-base font-semibold text-primary/50"
//           : "text-sm sm:text-base font-semibold text-muted";

//         return (
//           <div
//             key={idx}
//             className={outerClass}
//             style={{
//               transitionDelay: `${card.delay}ms`,
//               transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
//             }}
//           >
//             <div
//               className="card-body relative overflow-hidden"
//               style={{ padding: "var(--space-card-padding)" }}
//             >
//               <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
//                 {(() => {
//                   const Icon = (props.icons?.[card.key as KPIKey] ??
//                     card.icon) as React.ComponentType<null>;
//                   return <Icon className="h-full w-full" />;
//                 })()}
//               </div>

//               <div className="relative">
//                 <p className={labelClass}>{card.label}</p>
//               </div>

//               <p className={numberClass}>{props[card.key].toLocaleString()}</p>

//               <p className={subtitleClass}>{card.subtitle}</p>
//             </div>
//           </div>
//         );
//       })}
//     </section>
//   );
// };

// export default MonthlyKPI;
