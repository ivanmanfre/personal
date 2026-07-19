import React from 'react';
import { SubCard, clean } from './shared';
import {
  positioningLock,
  positioningObjections,
  toolStackReplaced,
  toolStackTotalLabel,
  positioningLoopBreak,
} from '../../../../../lib/strategyConfig';

/**
 * Positioning & Offer — the centerpiece. This IS the positioning lock, so it
 * gets the printed-document treatment: a numbered definition list for the lock,
 * a ruled clinical Q / declarative A table for the objections, an admin cost
 * table with the total boxed (THE BOX), and the loop/break as two ruled
 * statement panels. Four collapsible sub-blocks (ledger element 13).
 */
export const PositioningOfferDoc: React.FC = () => (
  <section className="pos-sec">
    <div className="pos-sec-head">
      <h2 className="pos-sec-title">Positioning &amp; Offer</h2>
      <span className="pos-sec-meta">Locked 2026-07-03</span>
    </div>
    <p className="pos-sec-note">
      The ratified $2k position, the objection answers, and the DIY-cost math. A live reference for sales calls.
    </p>

    <SubCard title="The Lock">
      <div className="pos-lock">
        {positioningLock.map((item, i) => (
          <div className="pos-lock-row" key={item.label}>
            <div className="pos-lock-lbl">
              <span className="pos-lock-num">{String(i + 1).padStart(2, '0')}</span>
              {item.label}
            </div>
            <div className="pos-lock-val">{clean(item.value)}</div>
          </div>
        ))}
      </div>
    </SubCard>

    <SubCard title="Objections to answers">
      <div className="pos-obj">
        {positioningObjections.map((o) => (
          <div className="pos-obj-row" key={o.objection}>
            <div className="pos-obj-q">
              <p className="pos-obj-qt">&ldquo;{clean(o.objection)}&rdquo;</p>
            </div>
            <div className="pos-obj-a">
              <div className="pos-obj-al">
                Answer
                {o.isNew && <span className="pos-tag">new</span>}
              </div>
              <p className="pos-obj-at">{clean(o.answer)}</p>
            </div>
          </div>
        ))}
      </div>
    </SubCard>

    <SubCard title="What $2k replaces">
      <div className="pos-tablewrap">
        <table className="pos-cost">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Job</th>
              <th className="pos-r">$/mo</th>
            </tr>
          </thead>
          <tbody>
            {toolStackReplaced.map((t) => (
              <tr key={t.tool}>
                <td className="pos-tool">{clean(t.tool)}</td>
                <td>{clean(t.job)}</td>
                <td className="pos-r pos-cost-n">{clean(t.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Plain hairline-ruled figure, not THE BOX (that grammar is warnings-only). */}
      <div className="pos-cost-figure">
        <div className="pos-cost-total">
          <span className="pos-cost-total-lbl">Tools only, and you still run them yourself</span>
          <span className="pos-cost-total-n">{clean(toolStackTotalLabel)}</span>
        </div>
      </div>
      <p className="pos-cost-foot">
        $2k covers every tool above plus the operator running them. One line, zero vendor invoices, zero API keys.
      </p>
    </SubCard>

    <SubCard title="The loop and the break">
      <div className="pos-lb">
        {positioningLoopBreak.map((item) => (
          <div className="pos-lb-item" key={item.kind}>
            <div className="pos-lb-lbl">{item.label}</div>
            <p className="pos-lb-body">{clean(item.body)}</p>
          </div>
        ))}
      </div>
    </SubCard>
  </section>
);
