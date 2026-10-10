# Revenue Copilot — Product Requirements

**Primary goal:** Help hotel sales teams identify relevant revenue opportunities within
existing proposals.

## 1. Problem Statement

Hotel sales teams build many proposals for events (conferences, meetings, weddings, group
stays) under time pressure. Proposals often contain only the core request (rooms, a meeting
room, a lunch), even though the hotel offers relevant products that would improve the event
and raise revenue: an AV package for a conference, a coffee break for a full-day meeting,
a room upgrade for a VIP group, an extra night for a multi-day event.

Spotting these opportunities depends on each salesperson's experience and catalog knowledge,
and it is easy to miss under time pressure. The result is lost revenue per booking and an
inconsistent guest experience.

## 2. Target Users

- **Primary:** Hotel and venue salespeople (event, MICE and group sales) who create and
  manage proposals in Proposales.
- **Secondary:** Sales managers who want consistent upselling practices and insight into
  which suggestions their team accepts or dismisses.

## 3. Value Proposition

Revenue Copilot reviews an existing proposal against the hotel's real product catalog and
suggests up to three relevant, explained revenue opportunities, along with a deterministic
estimate of the potential additional revenue. The salesperson stays in control: they accept
or dismiss each suggestion, and the reasons they give are captured.

### Why it complements Proposales

Proposales already handles proposal creation, digital proposals and e-signing well.
Revenue Copilot does **not** rebuild any of that. It:

- **Reads** proposals and products from Proposales through its API (no separate catalog).
- **Adds** an analysis layer that Proposales does not provide: contextual revenue suggestions
  with explanations.
- **Stays out of the customer-facing flow.** It never sends, publishes or e-signs proposals.
- **Writes back** the opportunities the salesperson chose to the proposal *draft*, only after
  they confirm the update. Every opportunity becomes an **optional extra** the
  customer can pick in the Proposales proposal (an upgrade as a supplement priced at the
  difference); what the customer already has never changes. The
  salesperson then finishes and sends the proposal in Proposales as usual.

## 4. Core User Journey

1. Select an existing proposal from Proposales.
2. Retrieve proposal details and available hotel products.
3. Use an LLM to analyze the event context.
4. Identify up to three relevant revenue opportunities.
5. Explain why each recommendation is appropriate.
6. Add each recommendation to the proposal, or mark it as not a fit.
7. Capture the reason when a recommendation is not a fit.
8. Simulate the potential additional revenue.
9. Update the draft in Proposales after confirming: optional extras for the
   customer to pick, the existing items unchanged. Nothing is sent to the customer.

## 5. Revenue Opportunity Types

| Type | Description | Example | Uplift calculation |
|------|-------------|---------|--------------------|
| **Cross-sell** | Add a relevant product not yet in the proposal | AV package for a conference | Product price × appropriate quantity |
| **Upgrade** | Replace an existing product with a higher-value one | Standard → superior room | (Replacement price − existing price) × quantity |
| **Extension** | Extend an existing service or duration | Extra night, half-day → full-day | Additional units × unit price |

All calculations use catalog prices, a single currency, and a consistent VAT basis.
If pricing is missing, the uplift is shown as unavailable rather than estimated.

## 6. Role of the LLM

The LLM is used for what it does well:

- Understanding event context (type, size, duration, purpose) from proposal content.
- Judging which catalog products are relevant to that context.
- Writing a short, salesperson-facing explanation for each recommendation.
- Providing a qualitative confidence level (low / medium / high), which is not a
  conversion probability.

The LLM must **not**:

- Invent products, prices, availability or customer preferences.
- Calculate revenue. That is done by deterministic code.
- Modify proposals directly.

Guardrails:

- The LLM returns structured output validated by Zod.
- Every product ID it returns is checked against the real catalog; unknown IDs are discarded.
- "No recommendations" is a valid, expected result.

## 7. Human-in-the-loop Feedback

Each recommendation can be **accepted** or **dismissed**. Dismissal requires a reason:

- Already included in another package.
- Customer has a strict budget.
- Not relevant to this event.
- Product is unavailable.
- Other.

An optional free-text comment can add context.

Feedback is stored in a structured way so it can later improve recommendations (for example,
by feeding recent dismissals into the prompt or by analyzing patterns), without fine-tuning
a model. The storage mechanism (in-memory, file, or PostgreSQL) will be decided based on
what can be justified in Step 7.

## 8. MVP Success Criteria

- A salesperson can select a real proposal fetched from the Proposales API.
- The app retrieves the proposal details and the hotel's real product catalog.
- The app returns 0–3 recommendations, each referencing a valid catalog product and
  including an explanation and qualitative confidence.
- Potential additional revenue is calculated deterministically, labeled as potential,
  and never mixes currencies or VAT bases.
- Each recommendation can be accepted or dismissed, and dismissals capture a reason and an
  optional comment.
- No API keys reach the browser, and no proposal is sent or published automatically.
- The app is deployed to Vercel and works end to end.

## 9. Out of Scope

- Creating proposals from scratch, or editing them in a customer-facing way.
- Sending, publishing or e-signing proposals.
- Complex authentication or multi-tenant user management.
- Dynamic pricing engines or price optimization.
- Model fine-tuning, vector databases, or multi-agent orchestration.
- Microservices or unnecessary infrastructure.

## 10. Future Improvements

- Use aggregated feedback (acceptance and dismissal patterns) to tune prompts and ranking.
- Bring in historical proposal outcomes (won/lost) to prioritize opportunities.
- Manager analytics: acceptance rates, revenue influenced, most-dismissed products.
- Batch analysis across all open proposals.
- Seasonality and availability awareness, if the data becomes available through the API.
- Deeper integration with Proposales (e.g. an embedded panel), if the platform supports it.
