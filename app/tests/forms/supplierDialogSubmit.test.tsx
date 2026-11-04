import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

GlobalRegistrator.register({ url: "http://localhost:5173/purchasing/suppliers" });

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { api } = await import("@/api/client");
const { SupplierDialog } = await import("@/components/suppliers/SupplierDialog");

type Reply = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

const sentRequests: string[] = [];
let reply: Reply;

function respondWith(status: number, data: unknown, delayMs = 50): Reply {
  return (config) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const response: AxiosResponse = { status, statusText: "", data, headers: {}, config };
        if (status >= 400) {
          reject(new AxiosError("Request failed", AxiosError.ERR_BAD_REQUEST, config, null, response));
          return;
        }
        resolve(response);
      }, delayMs);
    });
}

const createdSupplier = {
  id: 7,
  name: "Acme Medical Supplies",
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  is_active: true,
};

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  let closed = 0;
  render(
    <QueryClientProvider client={queryClient}>
      <SupplierDialog onClose={() => closed++} />
    </QueryClientProvider>,
  );
  return { closedCount: () => closed };
}

function supplierForm(): HTMLFormElement {
  const form = document.getElementById("supplier-form");
  assert.ok(form instanceof HTMLFormElement, "supplier form is rendered");
  return form;
}

describe("supplier dialog submit guard", () => {
  before(() => {
    api.defaults.adapter = (config) => {
      sentRequests.push(`${config.method?.toUpperCase()} ${config.url}`);
      return reply(config);
    };
  });

  afterEach(() => {
    cleanup();
    sentRequests.length = 0;
  });

  after(async () => {
    await GlobalRegistrator.unregister();
  });

  it("sends one create request when the form is submitted twice in a row", async () => {
    reply = respondWith(201, createdSupplier);
    const dialog = renderDialog();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Acme Medical Supplies" } });

    fireEvent.submit(supplierForm());
    fireEvent.submit(supplierForm());

    await waitFor(() => assert.equal(dialog.closedCount(), 1));
    assert.deepEqual(sentRequests, ["POST /staff/suppliers"]);
  });

  it("lets the form submit again after the server rejects it", async () => {
    reply = respondWith(422, { message: "The name field is required.", errors: { name: ["The name field is required."] } });
    const dialog = renderDialog();

    fireEvent.submit(supplierForm());
    await screen.findByText("The name field is required.");

    reply = respondWith(201, createdSupplier);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Acme Medical Supplies" } });
    fireEvent.submit(supplierForm());

    await waitFor(() => assert.equal(dialog.closedCount(), 1));
    assert.deepEqual(sentRequests, ["POST /staff/suppliers", "POST /staff/suppliers"]);
  });
});
