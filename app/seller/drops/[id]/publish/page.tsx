import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getDrop } from '@/lib/actions/drops'
import { PublishDraftForm } from '@/components/seller/publish-draft-form'

export const metadata = { title: 'Publish Drop — DropDeck' }

export default async function PublishDraftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'seller') redirect('/auth/signin')

  const drop = await getDrop(id)
  if (!drop || drop.sellerId !== session.user.id) redirect('/seller/dashboard')
  if (drop.status !== 'draft') redirect('/seller/dashboard')

  return <PublishDraftForm drop={drop} />
}
