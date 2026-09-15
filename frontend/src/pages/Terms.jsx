import useDocumentMeta from '../hooks/useDocumentMeta'

export default function Terms() {
  useDocumentMeta(
    'Terms of Service — SettleNG',
    'The terms that govern using SettleNG as a tenant, landlord, or agent, including account responsibilities and listing accuracy.',
  )

  return (
    <div className="static-page">
      <div className="static-page-card">
        <h1>Terms of Service</h1>
        <p className="static-page-updated">Last updated: September 2026</p>

        <h2>What SettleNG is</h2>
        <p>
          SettleNG is a marketplace that connects people looking for a place
          to rent with landlords and agents who have places to rent. We help
          you find listings, understand who you're dealing with, see the
          real cost of moving in, and arrange inspections — all in one
          place. SettleNG is not a party to any rental agreement, tenancy,
          or transaction between a tenant and a landlord or agent. We don't
          collect rent, sign leases, or manage properties. Any agreement you
          reach with another user is between you and them.
        </p>

        <h2>Your account</h2>
        <p>
          You're responsible for the accuracy of the information on your
          account and for keeping your login secure. Each person should
          have one account, used in a way appropriate to their role —
          tenants search and inspect, landlords and agents list properties
          they're actually authorized to rent out, and admins moderate the
          platform. Don't create an account on someone else's behalf, or
          more than one account for yourself.
        </p>

        <h2>Listing accuracy</h2>
        <p>
          If you list a property, every listing must show a full,
          honest move-in cost breakdown — rent, agency fee, agreement fee,
          caution fee, service charge, and any other fee — not just a
          headline rent figure. If a fee genuinely isn't decided yet, mark
          it as not provided rather than guessing or leaving tenants to
          find out later. Listings must describe a property that actually
          exists, that you're actually authorized to list, and that's
          actually available on the terms shown.
        </p>

        <h2>What verification badges actually mean</h2>
        <p>
          SettleNG shows separate verification badges for different things,
          and they mean different things:
        </p>
        <ul>
          <li>
            <strong>Phone verified</strong> means the person confirmed they
            control the phone number on their account.
          </li>
          <li>
            <strong>Identity verified</strong> means an admin reviewed a
            government-issued ID they submitted. It does not confirm
            property ownership.
          </li>
          <li>
            <strong>Property verified</strong> means an admin reviewed
            ownership documents for that specific listing. It does not
            verify the identity of whoever is currently messaging you about
            it.
          </li>
        </ul>
        <p>
          None of these badges — separately or together — guarantee that a
          person will act honestly, that a transaction will go smoothly, or
          that you cannot be scammed. Use your own judgment, meet in safe
          public settings for inspections where possible, and never send
          money outside of what you've independently confirmed.
        </p>

        <h2>Prohibited conduct</h2>
        <p>
          You may not use SettleNG for fraud, harassment, posting fake or
          duplicate listings, misrepresenting yourself or a property, or
          trying to get around our verification or moderation systems. We
          rely on user reports and admin review to catch this — please
          report anything that looks wrong.
        </p>

        <h2>Suspension</h2>
        <p>
          If your account is suspended, you'll be signed out and shown the
          reason on your next attempt to log in. Admins suspend accounts
          for violations of these terms; if you believe a suspension was a
          mistake, contact support.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          SettleNG facilitates discovery and communication between tenants
          and landlords/agents. We are not liable for the condition of any
          property, the conduct of any user, or the outcome of any
          inspection, tenancy, or agreement made through the platform.
        </p>

        <div className="static-page-note">
          This is a good-faith draft written to reflect how SettleNG
          actually works today. It has not been reviewed by a lawyer and
          will be revisited before any commercial or paid launch.
        </div>
      </div>
    </div>
  )
}
