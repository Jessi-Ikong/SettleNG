export default function Privacy() {
  return (
    <div className="static-page">
      <div className="static-page-card">
        <h1>Privacy Policy</h1>
        <p className="static-page-updated">Last updated: September 2026</p>

        <h2>What we collect</h2>
        <p>
          When you register, we collect your name, phone number, email
          address, and role (tenant, landlord, or agent). If you list a
          property, we collect the property's details — location, pricing,
          amenities, photos, and description. If you submit identity or
          property-ownership verification, we collect the document you
          upload. Messages, inspection requests, favorites, saved searches,
          and reviews are all stored against your account so the relevant
          features work.
        </p>

        <h2>Why we collect it</h2>
        <p>
          This data exists to run the features you're actually using:
          location search and filtering, showing who you're dealing with,
          identity and property ownership verification, in-app messaging
          between tenants and landlords/agents, and inspection scheduling.
          We don't collect anything beyond what those features need.
        </p>

        <h2>Who can see what</h2>
        <p>
          Property listings, your name, and your verification badges are
          visible to anyone using SettleNG — that's the point of the
          platform. Uploaded identity and property-ownership documents are
          different: they're stored in a private storage bucket, never
          public, and are only ever accessible to you (the person who
          submitted them) and admins reviewing your submission, via
          temporary links that expire shortly after they're generated. No
          other user — including landlords, agents, or other tenants — can
          see your verification documents. Messages within a conversation
          are only visible to the tenant and landlord/agent on that
          conversation.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep your account data for as long as your account is active.
          If you ask us to delete your account, we'll do so, though some
          records (like transaction-adjacent history needed for legitimate
          moderation or record-keeping purposes) may be retained where
          reasonably necessary even after deletion.
        </p>

        <h2>Third parties</h2>
        <p>
          SettleNG runs on Supabase, which provides our database,
          authentication, and file storage. We don't use advertising
          trackers, and we don't sell your data to anyone.
        </p>

        <div className="static-page-note">
          This is a good-faith draft written to reflect how SettleNG
          actually handles data today. It has not been reviewed by a
          lawyer and will need a real legal and Nigeria Data Protection
          Act (NDPA) review before any commercial launch — especially
          given the sensitive personal data (identity documents) this
          platform handles.
        </div>
      </div>
    </div>
  )
}
