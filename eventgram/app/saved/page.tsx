import SavedList from "@/components/SavedList";
import { todayIST } from "@/lib/format";

export default function SavedPage() {
  return (
    <main className="wrap page">
      <SavedList today={todayIST()} />
    </main>
  );
}
