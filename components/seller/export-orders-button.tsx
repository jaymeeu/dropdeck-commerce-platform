import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function ExportOrdersButton({ dropId }: { dropId: string }) {
  return (
    <Link href={`/api/seller/drops/${dropId}/orders/export`} download>
      <Button variant="outline" size="sm" className="border-white/20 hover:border-[#6366f1]">
        Export CSV
      </Button>
    </Link>
  )
}
