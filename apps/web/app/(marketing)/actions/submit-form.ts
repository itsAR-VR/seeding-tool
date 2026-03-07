"use server";

export type LeadFormState = {
  message: string;
  status: "error" | "idle" | "success";
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value: string, max: number) {
  return value.slice(0, max);
}

const successState: LeadFormState = {
  status: "success",
  message: "Thanks. We got it and will follow up shortly.",
};

export async function submitLead(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const source = clamp(asString(formData.get("source")), 80);
  const name = clamp(asString(formData.get("name")), 120);
  const email = clamp(asString(formData.get("email")).toLowerCase(), 160);
  const website = clamp(asString(formData.get("website")), 200);
  const teamSize = clamp(asString(formData.get("teamSize")), 80);
  const monthlyCampaigns = clamp(asString(formData.get("monthlyCampaigns")), 80);

  if (!name || !email) {
    return {
      status: "error",
      message: "Name and email are required.",
    };
  }

  if (!email.includes("@")) {
    return {
      status: "error",
      message: "Use a valid work email.",
    };
  }

  const payload = {
    email,
    monthlyCampaigns,
    name,
    source,
    submittedAt: new Date().toISOString(),
    teamSize,
    website,
  };

  const webhookUrl = process.env.FORM_WEBHOOK_URL;

  if (!webhookUrl) {
    console.info("FORM_WEBHOOK_URL not set; skipping webhook post.", payload);
    return successState;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "error",
        message: "We could not send that right now. Please try again in a minute.",
      };
    }
  } catch (error) {
    console.error("Lead submission failed", error);
    return {
      status: "error",
      message: "We could not send that right now. Please try again in a minute.",
    };
  }

  return successState;
}
