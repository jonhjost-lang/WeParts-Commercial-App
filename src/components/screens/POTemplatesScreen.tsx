import { PO_TEMPLATES } from '../../lib/poTemplates';

/**
 * Which purchase order layouts the parser recognizes.
 *
 * Reads the registry in code — no Dataverse table involved. Registering a new
 * layout by drawing zones over a PDF is phase 2 of the technical spec; today a
 * new customer is added by appending to PO_TEMPLATES.
 */
export default function POTemplatesScreen() {
  return (
    <section className="screen active">
      <div className="orders-heading">
        <div>
          <span className="commerce-kicker">ADMINISTRATION</span>
          <h1>PO Templates</h1>
          <p>Purchase order layouts the parser recognizes. A PDF that matches none of these is rejected with an explicit message — the parser never guesses a layout.</p>
        </div>
      </div>

      <div className="orders-card">
        <div className="wep-po-tablewrap">
          <table className="wep-po-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Customer</th>
                <th>Currency</th>
                <th className="num">Header fields</th>
                <th className="num">Match rules</th>
              </tr>
            </thead>
            <tbody>
              {PO_TEMPLATES.map((template) => (
                <tr key={template.id}>
                  <td><b>{template.label}</b><br /><span className="mono">{template.id}</span></td>
                  <td>{template.customer}</td>
                  <td>{template.currencyDefault}</td>
                  <td className="num">{Object.keys(template.header).length}</td>
                  <td className="num">{template.fingerprint.all.length + template.fingerprint.any.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="orders-table-footer">
          <span>Showing <b>{PO_TEMPLATES.length}</b> registered layout(s)</span>
          <small>Adding a layout requires a code change · visual template editor is phase 2</small>
        </div>
      </div>
    </section>
  );
}
