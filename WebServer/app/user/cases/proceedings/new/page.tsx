import { redirect } from "next/navigation";

export default function ProceedingsNewPage() {
  redirect("/user/cases/proceedings/add");
}
