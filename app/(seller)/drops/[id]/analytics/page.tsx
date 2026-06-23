import { redirect } from 'next/navigation'
export default function OldAnalytics({ params }: { params: { id: string } }) {
  redirect(`/seller/drops/${params.id}/analytics`)
}
