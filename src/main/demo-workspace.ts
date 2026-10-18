import { randomUUID } from "node:crypto";
import { openDatabase } from "./database";
import { ShopService, DomainError } from "./service";
import type { Operation } from "../shared/contracts";
/** A disposable sample database. Never replaces, saves into, or merges with the live database. */
export function sampleShop(): ShopService {
  const s = new ShopService(openDatabase(":memory:"), true);
  try {
    s.invoke("setup", {
      username: "sample-owner",
      password: randomUUID() + randomUUID(),
    });
    s.run(
      "INSERT INTO settings(key,value) VALUES('store',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      JSON.stringify("Fixer Tools DEMO"),
    );
    s.run(
      "INSERT INTO settings(key,value) VALUES('footer',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      JSON.stringify("DEMO — SAMPLE TRANSACTION / NOT A REAL SALE"),
    );
    s.invoke("cashMovement", {
      request: randomUUID(),
      direction: "in",
      amount: 20000000,
      currency: "MMK",
      reason: "DEMO opening capital",
    });
    const supplier = s.invoke("contact", {
      name: "DEMO Mobile Wholesale",
      kind: "supplier",
      phone: "DEMO-SUPPLIER",
    });
    const customers = Array.from({ length: 12 }, (_, i) =>
      s.invoke("contact", {
        name: `DEMO Customer ${i + 1}`,
        kind: "customer",
        phone: `DEMO-CUSTOMER-${i + 1}`,
      }),
    );
    const brands = ["Apple", "Samsung", "Xiaomi", "Oppo", "Google"];
    for (let i = 0; i < 40; i++) {
      const cost = 150000 + i * 5000;
      s.invoke("purchase", {
        request: randomUUID(),
        contactId: supplier,
        currency: "MMK",
        brand: brands[i % 5],
        model: `DEMO ${["iPhone 12", "Galaxy A54", "Redmi Note 12", "Reno 8", "Pixel 6"][i % 5]} ${i + 1}`,
        alternate: `DEMO-PHONE-${String(i + 1).padStart(4, "0")}`,
        alternateApproved: true,
        condition: "used",
        grade: i % 3 === 0 ? "B" : "A",
        cost,
        price: cost + 50000,
        minimum: cost + 10000,
        paid: cost,
        method: "Cash",
        details: "Synthetic sample device; not a real IMEI",
      });
    }
    for (let i = 0; i < 60; i++)
      s.invoke("accessory", {
        sku: `SAMPLE-${String(i + 1).padStart(3, "0")}`,
        name: `DEMO ${["USB-C cable", "Fast charger", "Phone case", "Earphones", "Screen protector"][i % 5]} ${i + 1}`,
        category: "DEMO",
        cost: 1000 + i * 50,
        price: 3000 + i * 100,
        currency: "MMK",
        quantity: i < 5 ? 1 : 8 + (i % 8),
        reorder: 3,
        method: "Cash",
      });
    for (let i = 0; i < 12; i++) {
      const phone = s.row("SELECT * FROM phones WHERE id=?", i + 1)!;
      s.invoke("sale", {
        request: randomUUID(),
        contactId: customers[i],
        currency: "MMK",
        items: [
          {
            kind: "phone",
            id: phone.id,
            quantity: 1,
            price: phone.price,
            warrantyDays: 30,
          },
        ],
        payments: [
          {
            amount: i % 4 === 0 ? phone.price - 50000 : phone.price,
            method: i % 3 === 0 ? "Bank transfer" : "Cash",
          },
        ],
      });
    }
    for (let i = 0; i < 6; i++) {
      const id = s.invoke("repair", {
        contactId: customers[i],
        device: `DEMO ${brands[i % 5]} repair`,
        identifier: `DEMO-REPAIR-${i + 1}`,
        problem: ["Screen replacement", "Battery replacement", "Charging port"][
          i % 3
        ],
        estimate: 25000 + i * 5000,
        currency: "MMK",
      });
      if (i > 1)
        s.invoke("repairUpdate", {
          id,
          status: "Repairing",
          approved: true,
          final: 25000 + i * 5000,
          reason: "DEMO customer approval",
        });
      if (i > 3) {
        s.invoke("payment", {
          request: randomUUID(),
          target: "repair",
          id,
          amount: 25000 + i * 5000,
          method: "Cash",
        });
        s.invoke("repairUpdate", {
          id,
          status: i === 5 ? "Delivered" : "Ready for Collection",
          approved: true,
          final: 25000 + i * 5000,
          reason: "DEMO repair completed",
        });
      }
    }
    s.invoke("expense", {
      request: randomUUID(),
      category: "Shop supplies",
      description: "DEMO cleaning and packaging",
      amount: 18000,
      currency: "MMK",
      method: "Cash",
    });
    s.invoke("rate", {
      from: "USD",
      to: "MMK",
      numerator: 3500,
      denominator: 1,
      source: "DEMO practice rate — not a market quote",
    });
    s.invoke("rate", {
      from: "THB",
      to: "MMK",
      numerator: 100,
      denominator: 1,
      source: "DEMO practice rate — not a market quote",
    });
    return s;
  } catch (e) {
    s.db.close();
    throw e;
  }
}
export class DemoWorkspace {
  private live: ShopService | null = null;
  get active() {
    return this.live !== null;
  }
  enter(current: ShopService) {
    if (this.active) return current;
    current.require("demoDataset");
    if (current.user?.role !== "Owner") throw new DomainError("FORBIDDEN");
    const demo = sampleShop();
    this.live = current;
    return demo;
  }
  leave(current: ShopService) {
    if (!this.live) return current;
    const live = this.live;
    this.live = null;
    current.db.close();
    return live;
  }
  guard(operation: Operation) {
    if (
      this.active &&
      [
        "backup",
        "restore",
        "export",
        "bugExport",
        "photo",
        "support",
        "password",
        "recoveryGenerate",
        "recoveryReset",
        "users",
        "permission",
        "setup",
        "login",
      ].includes(operation)
    )
      throw new DomainError("DEMO_RESTRICTED");
  }
}
