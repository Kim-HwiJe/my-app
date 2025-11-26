'use client'

import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function Home() {
  return (
    <div className="flex justify-center items-start mt-10">
      <Button variant="default" size="lg">
        Button: click me
      </Button>
    </div>
  )
}
