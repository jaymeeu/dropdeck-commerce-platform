import { redirect } from 'next/navigation'
export default function OldDropDetail({ params }: { params: { id: string } }) {
  redirect(`/drops/${params.id}`)
}
