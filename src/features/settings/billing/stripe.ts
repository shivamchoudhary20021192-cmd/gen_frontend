/**
 * Stripe.js, loaded only when a merchant adds a card through Stripe. Card
 * numbers go from Stripe's iframe straight to Stripe; this admin never sees
 * them, which keeps it out of PCI scope.
 */

export interface StripeCardElement {
  mount(target: HTMLElement): void
  destroy(): void
  on(event: 'change', handler: (event: { complete: boolean; error?: { message: string } }) => void): void
}

export interface StripeClient {
  elements(): { create(type: 'card', options?: Record<string, unknown>): StripeCardElement }
  confirmCardSetup(
    clientSecret: string,
    data: { payment_method: { card: StripeCardElement } },
  ): Promise<{ setupIntent?: { id: string; status: string }; error?: { message: string } }>
  confirmCardPayment(clientSecret: string): Promise<{ paymentIntent?: { id: string; status: string }; error?: { message: string } }>
}

type StripeFactory = (publishableKey: string) => StripeClient

let loading: Promise<StripeFactory> | null = null

export function loadStripe(): Promise<StripeFactory> {
  const existing = (window as unknown as { Stripe?: StripeFactory }).Stripe
  if (existing) return Promise.resolve(existing)
  loading ??= new Promise<StripeFactory>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/'
    script.async = true
    script.onload = () => {
      const factory = (window as unknown as { Stripe?: StripeFactory }).Stripe
      if (factory) resolve(factory)
      else reject(new Error('Stripe did not load.'))
    }
    script.onerror = () => {
      loading = null
      reject(new Error('Could not load Stripe. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loading
}
