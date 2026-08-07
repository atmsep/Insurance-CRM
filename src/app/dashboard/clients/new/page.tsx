import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Νέος πελάτης</h1>
      <ClientForm />
    </div>
  );
}
