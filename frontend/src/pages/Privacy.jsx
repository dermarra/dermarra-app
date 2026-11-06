import { Link } from "react-router-dom";

/** Privacy policy, written against Kenya's Data Protection Act, 2019 (DPA) and
 * the Data Protection (General) Regulations, 2021. It describes what the
 * system actually does -- if you add a new kind of data, a new service
 * provider or a new tracker, update this page in the same change. */

const UPDATED = "7 November 2026";
const CONTACT_EMAIL = "privacy@dermarra.com";

const DATA = [
  {
    what: "Account details",
    items: "Name, email address, phone number, password (stored only as a one-way hash, never readable by us).",
    why: "To create and run your account, let you sign in and see your orders.",
    basis: "Contract (s. 30(1)(b)(i) DPA)",
  },
  {
    what: "Delivery details",
    items: "Delivery name, address, city, country, postal code and phone, for each order and, if you choose, saved to your account.",
    why: "To deliver your order and contact you about it.",
    basis: "Contract",
  },
  {
    what: "Orders and payments",
    items:
      "What you bought, prices, discount codes used, order status, the M-Pesa phone number you paid from, the M-Pesa receipt number and Safaricom's result message. We never see or store your M-Pesa PIN.",
    why: "To take payment, fulfil and track your order, handle returns and keep the records the law requires.",
    basis: "Contract; legal obligation (tax law)",
  },
  {
    what: "Delivery proof",
    items: "A photo taken when your parcel is handed over, and a tracking number where there is one.",
    why: "To confirm delivery and resolve any dispute about it.",
    basis: "Legitimate interest (s. 30(1)(b)(vi) DPA)",
  },
  {
    what: "Wishlist and cart",
    items: "Products you save or add to your cart.",
    why: "So your choices are still there when you come back.",
    basis: "Contract",
  },
  {
    what: "Newsletter",
    items: "Email address and name, only if you tick the box or sign up in the footer or on the blog.",
    why: "To send you skincare tips and offers.",
    basis: "Consent (s. 30(1)(a), s. 37 DPA)",
  },
  {
    what: "Anonymous visit counts",
    items:
      "A random visitor number kept in your browser, the page you landed on, the website that sent you there (for example instagram.com), and whether you use a phone, tablet or computer. No name, IP address or cookie.",
    why: "To count how many people visit the shop and which pages they use.",
    basis: "Legitimate interest",
  },
];

const SHARING = [
  ["Safaricom PLC (M-Pesa)", "Your phone number and the amount, to send the payment prompt and confirm payment.", "Kenya"],
  ["Whoever delivers your order", "Your name, phone and delivery address.", "Kenya"],
  ["Brevo (email)", "Your name and email, to send order emails, password resets and, if you agreed, the newsletter.", "European Union"],
  ["Supabase (database)", "Everything we keep about you is stored in our database, hosted by Supabase.", "Outside Kenya"],
  ["Render (our server)", "Our application runs here and processes your requests.", "Outside Kenya"],
  ["Cloudflare (website and domain)", "Delivers the website to your browser and protects it from attacks.", "Global network"],
  ["Cloudinary (images)", "Product photos and delivery-proof photos.", "Outside Kenya"],
  ["Zoho (our mailbox)", "Emails you send us.", "Outside Kenya"],
];

const RIGHTS = [
  ["Be informed", "how your data is used -- this page."],
  ["Access", "a copy of the personal data we hold about you."],
  ["Correct", "data that is wrong or out of date. You can change your profile and saved address yourself under Account."],
  ["Delete", "data that is false, misleading or no longer needed, or your whole account. We will keep only what the law makes us keep (see How long we keep it)."],
  ["Object", "to our use of your data for a legitimate interest, or to direct marketing at any time."],
  ["Withdraw consent", "for the newsletter at any time, using the unsubscribe link in any email or by writing to us. This doesn't affect what we did before."],
  ["Data portability", "receive your data in a common, machine-readable format, or have it sent to another business."],
  ["Not be subject to decisions made only by automated means", "that significantly affect you. We make no such decisions -- the skin quiz only suggests a routine."],
];

const SECTIONS = [
  ["who", "Who we are"],
  ["collect", "What we collect and why"],
  ["share", "Who we share it with"],
  ["abroad", "Data stored outside Kenya"],
  ["browser", "What we keep in your browser"],
  ["keep", "How long we keep it"],
  ["security", "How we protect it"],
  ["rights", "Your rights"],
  ["marketing", "Marketing emails"],
  ["children", "Children"],
  ["complain", "Complaints"],
  ["changes", "Changes to this policy"],
];

function H2({ id, children }) {
  return (
    <h2 id={id} className="scroll-mt-28 font-display font-semibold text-3xl text-ink mt-16 mb-5">
      {children}
    </h2>
  );
}

const Mail = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-blue-700 underline underline-offset-2">
    {CONTACT_EMAIL}
  </a>
);

export default function Privacy() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 pt-14 sm:pt-20 pb-20">
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,48rem)] lg:gap-16">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/70 mb-4">On this page</p>
            <ol className="flex flex-col gap-2.5 text-base">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-ink/70 hover:text-ink transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="text-base leading-relaxed text-ink [&_p]:mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 !mb-3">Legal</p>
          <h1 className="font-display font-semibold text-4xl sm:text-5xl text-ink mb-5">Privacy policy</h1>
          <p className="text-ink/70">Last updated {UPDATED}</p>
          <p className="text-xl leading-relaxed">
            This policy explains what personal data Dermarra Skincare collects when you use dermarra.com, why, who we share
            it with and the rights you have under Kenya&apos;s <strong>Data Protection Act, 2019</strong> and the{" "}
            <strong>Data Protection (General) Regulations, 2021</strong>. We collect only what we need to sell and deliver
            your skincare, and we never sell your data.
          </p>

          <H2 id="who">Who we are</H2>
          <p>
            Dermarra Skincare, a Kenyan skincare brand, is the <strong>data controller</strong> for the personal data
            collected through this website: we decide why and how it is used. The companies listed under{" "}
            <a href="#share" className="font-semibold text-blue-700 underline underline-offset-2">Who we share it with</a>{" "}
            process it for us as <strong>data processors</strong>, under our instructions.
          </p>
          <p>
            For anything about your data, write to <Mail />.
          </p>

          <H2 id="collect">What we collect and why</H2>
          <p>
            We process personal data lawfully, fairly and openly, for clear purposes, and keep it accurate and no longer than
            needed (s. 25 DPA). Each use rests on one of the lawful bases in s. 30 of the Act:
          </p>
          <div className="flex flex-col gap-3 mt-6">
            {DATA.map((d) => (
              <section key={d.what} className="rounded-lg border border-mist bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
                  <h3 className="font-display font-semibold text-xl text-ink">{d.what}</h3>
                  <span className="text-sm text-ink/70">{d.basis}</span>
                </div>
                <p className="!mb-2">{d.items}</p>
                <p className="!mb-0 text-ink/70">
                  <span className="font-semibold text-ink">Why: </span>
                  {d.why}
                </p>
              </section>
            ))}
          </div>
          <p className="mt-6">
            <strong>What we don&apos;t collect:</strong> your answers to the skin quiz are used on the spot to suggest a
            routine and are not saved. We don&apos;t ask for health records, ID numbers or card numbers, and we don&apos;t
            use advertising trackers or sell or rent your data to anyone.
          </p>
          <p>
            If you don&apos;t give us the details needed for an order (name, phone and delivery address), we can&apos;t
            deliver it.
          </p>

          <H2 id="share">Who we share it with</H2>
          <p>
            Only with the people and services that help us run the shop, and only what each one needs. Each is bound by a
            contract or its own terms to keep your data safe and use it only for that job.
          </p>
          <div className="mt-6 overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="border-b border-mist text-sm text-ink/70">
                  <th scope="col" className="px-5 py-3 font-semibold">Who</th>
                  <th scope="col" className="px-5 py-3 font-semibold">What and why</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Where</th>
                </tr>
              </thead>
              <tbody>
                {SHARING.map(([who, what, where]) => (
                  <tr key={who} className="border-b border-mist last:border-0 align-top">
                    <th scope="row" className="px-5 py-4 font-semibold">{who}</th>
                    <td className="px-5 py-4">{what}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-ink/70">{where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6">
            Safaricom also handles M-Pesa payments under its own privacy policy. We may also disclose data when the law
            requires it, for example to the Kenya Revenue Authority or under a court order.
          </p>

          <H2 id="abroad">Data stored outside Kenya</H2>
          <p>
            Several of the services above store or process data outside Kenya. Under ss. 48&ndash;49 of the Act we only
            transfer personal data abroad to providers that give appropriate safeguards for its security and protection --
            through their data-processing terms and security commitments -- and only as far as is needed to run the shop.
            You can ask us for details of these safeguards.
          </p>

          <H2 id="browser">What we keep in your browser</H2>
          <p>
            We don&apos;t use cookies for tracking. The site saves a few small items in your browser&apos;s local storage:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-2 mb-4">
            <li>
              <strong>Sign-in keys</strong>, so you stay signed in. They are removed when you sign out.
            </li>
            <li>
              <strong>A random visitor number</strong>, used only to count visits. It isn&apos;t linked to your name or
              account. We don&apos;t count visits from our own staff.
            </li>
          </ul>
          <p>
            You can clear these at any time in your browser settings; you&apos;ll just need to sign in again.
          </p>

          <H2 id="keep">How long we keep it</H2>
          <ul className="list-disc pl-6 flex flex-col gap-2 mb-4">
            <li>
              <strong>Account and saved address:</strong> while your account is open. Ask us to delete it at any time.
            </li>
            <li>
              <strong>Orders, payments and delivery proof:</strong> five years from the order, because Kenyan tax law (the
              Tax Procedures Act, 2015) requires us to keep business records that long. Orders not paid within 24 hours are
              cancelled automatically.
            </li>
            <li>
              <strong>Newsletter:</strong> until you unsubscribe.
            </li>
            <li>
              <strong>Visit counts:</strong> kept as anonymous statistics.
            </li>
            <li>
              <strong>Emails you send us:</strong> as long as needed to answer you and deal with any follow-up.
            </li>
          </ul>
          <p>
            When data is no longer needed we delete it or make it anonymous, so it can no longer identify you (s. 39 DPA).
          </p>

          <H2 id="security">How we protect it</H2>
          <p>
            We build data protection into the shop by design (s. 41 DPA). The website is served only over an encrypted
            connection (HTTPS); passwords are stored as one-way hashes; password-reset links expire after 30 minutes and
            work once; and only staff who need it can see customer data -- each staff member has a role that limits what
            they can open, and changes they make are logged.
          </p>
          <p>
            If a breach of your personal data puts you at real risk, we will tell the Data Commissioner within 72 hours of
            becoming aware of it and tell you as soon as we reasonably can, with what happened and what you can do (s. 43
            DPA).
          </p>

          <H2 id="rights">Your rights</H2>
          <p>Under ss. 26 and 38 of the Act you have the right to:</p>
          <ul className="flex flex-col gap-3 mb-6">
            {RIGHTS.map(([right, detail]) => (
              <li key={right} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 w-2 h-2 shrink-0 rounded-full bg-blue" />
                <span>
                  <strong>{right}</strong> {detail}
                </span>
              </li>
            ))}
          </ul>
          <p>
            To use any of these rights, email <Mail /> from the address on your account (or tell us the phone number you
            ordered with). We may ask you to confirm who you are before acting. It&apos;s free, and we aim to respond within
            7 days, and always within the time the Regulations allow. If we can&apos;t do what you ask -- for example
            because the law makes us keep an order record -- we&apos;ll tell you why.
          </p>

          <H2 id="marketing">Marketing emails</H2>
          <p>
            We only send our newsletter if you ask for it -- the tick box at sign-up and checkout is never ticked for you.
            Every newsletter has an unsubscribe link. Order emails (confirmation, shipping updates, invoices, password
            resets) are part of your purchase and not marketing, so they keep coming while you have an open order.
          </p>

          <H2 id="children">Children</H2>
          <p>
            Our shop is meant for adults. You must be 18 or older to create an account or place an order. We don&apos;t
            knowingly collect data from children; if a parent or guardian believes a child has given us their details,
            contact us and we&apos;ll delete them (s. 33 DPA).
          </p>

          <H2 id="complain">Complaints</H2>
          <p>
            If you&apos;re unhappy with how we&apos;ve handled your data, please tell us first at <Mail /> and we&apos;ll
            try to put it right. You also have the right to complain to the{" "}
            <strong>Office of the Data Protection Commissioner (ODPC)</strong> at any time (s. 56 DPA):{" "}
            <a
              href="https://www.odpc.go.ke"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-700 underline underline-offset-2"
            >
              odpc.go.ke
            </a>
            .
          </p>

          <H2 id="changes">Changes to this policy</H2>
          <p>
            We&apos;ll update this page when what we do with data changes, and change the date at the top. If a change
            matters to you -- such as a new use of your data -- we&apos;ll tell you by email or on the site before it
            applies.
          </p>
          <p className="mt-10 text-ink/70">
            See also our <Link to="/terms" className="font-semibold text-blue-700 underline underline-offset-2">terms and conditions</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
