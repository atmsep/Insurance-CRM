// Hand-written types matching supabase/migrations in insurance-crm-db, scoped
// to the tables used by this MVP (clients, policies + branch details, tasks,
// carriers/insurance_lines lookups, agency_users). Once the Supabase CLI is
// available, replace with `supabase gen types typescript` output.

export type UserRole = "owner" | "admin" | "agent" | "viewer";
export type ClientType = "individual" | "legal_entity";
export type IdDocumentType = "adt" | "passport" | "other";
export type PolicyStatus =
  | "draft"
  | "active"
  | "pending_renewal"
  | "expired"
  | "cancelled"
  | "lapsed";
export type PaymentFrequency =
  | "single_premium"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual";
export type PaymentStatus = "pending" | "paid" | "overdue" | "partially_paid" | "cancelled";
export type InteractionType = "call" | "email" | "meeting" | "sms" | "note" | "other";
export type CommissionType = "new_business" | "renewal" | "override" | "cancellation";
export type CommissionStatus = "pending" | "invoiced" | "paid" | "cancelled";
export type ReferralRewardStatus = "pending" | "paid" | "cancelled";
export type ReferralRewardCalcType = "percent" | "fixed";
export type ReferralRewardSource = "auto" | "manual";
export type CommissionDirection = "incoming" | "outgoing";
export type PolicyMovementKind = "policy" | "renewal" | "endorsement" | "cancellation";
export type ClaimStatus =
  | "reported"
  | "under_review"
  | "approved"
  | "rejected"
  | "paid"
  | "closed";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "renewal_reminder" | "follow_up" | "payment_due" | "birthday" | "custom";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type VehicleUsage = "private" | "commercial" | "taxi" | "rental" | "motorcycle" | "other";
export type PropertyType = "apartment" | "house" | "commercial" | "industrial" | "land" | "other";
export type ClientMaritalStatus =
  | "single"
  | "married"
  | "divorced"
  | "widowed"
  | "cohabiting"
  | "other";
export type ClientRelationshipType = "spouse" | "child" | "parent" | "sibling" | "other";

export interface Database {
  public: {
    Tables: {
      agency_users: {
        Row: {
          id: string;
          auth_user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agency_users"]["Row"]> & {
          auth_user_id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["agency_users"]["Row"]>;
      };
      carriers: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          afm: string | null;
          is_active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["carriers"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["carriers"]["Row"]>;
      };
      insurance_lines: {
        Row: {
          id: string;
          code: string;
          name_el: string;
          requires_vehicle_details: boolean;
          requires_property_details: boolean;
          requires_life_health_details: boolean;
          is_active: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["insurance_lines"]["Row"]> & {
          code: string;
          name_el: string;
        };
        Update: Partial<Database["public"]["Tables"]["insurance_lines"]["Row"]>;
      };
      clients: {
        Row: {
          id: string;
          client_code: number;
          client_type: ClientType;
          display_name: string | null;
          afm: string | null;
          doy: string | null;
          email: string | null;
          phone_mobile: string | null;
          phone_landline: string | null;
          address_street: string | null;
          address_number: string | null;
          address_city: string | null;
          address_postal_code: string | null;
          address_region: string | null;
          address_country: string;
          iban: string | null;
          assigned_agent_id: string | null;
          notes: string | null;
          referral_source: string | null;
          referred_by_client_id: string | null;
          referrer_relationship: string | null;
          marketing_opt_in: boolean;
          gdpr_consent_at: string | null;
          income: number | null;
          marital_status: ClientMaritalStatus | null;
          nationality: string | null;
          language: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          client_type: ClientType;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
      };
      client_related_members: {
        Row: {
          id: string;
          client_id: string;
          related_client_id: string;
          relationship_type: ClientRelationshipType;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_related_members"]["Row"]> & {
          client_id: string;
          related_client_id: string;
          relationship_type: ClientRelationshipType;
        };
        Update: Partial<Database["public"]["Tables"]["client_related_members"]["Row"]>;
      };
      client_visits: {
        Row: {
          id: string;
          client_id: string;
          agency_user_id: string;
          visited_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_visits"]["Row"]> & {
          client_id: string;
          agency_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_visits"]["Row"]>;
      };
      client_individuals: {
        Row: {
          client_id: string;
          first_name: string;
          last_name: string;
          father_name: string | null;
          date_of_birth: string | null;
          id_document_type: IdDocumentType | null;
          id_document_number: string | null;
          amka: string | null;
          occupation: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["client_individuals"]["Row"]> & {
          client_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_individuals"]["Row"]>;
      };
      client_legal_entities: {
        Row: {
          client_id: string;
          company_name: string;
          legal_form: string | null;
          kad: string | null;
          gemi_number: string | null;
          legal_representative_name: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["client_legal_entities"]["Row"]> & {
          client_id: string;
          company_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_legal_entities"]["Row"]>;
      };
      policies: {
        Row: {
          id: string;
          policy_group_id: string;
          previous_policy_id: string | null;
          policy_number: string;
          client_id: string;
          carrier_id: string;
          insurance_line_id: string;
          assigned_agent_id: string | null;
          broker_office_id: string | null;
          risk_label: string | null;
          status: PolicyStatus;
          issue_date: string | null;
          start_date: string;
          end_date: string;
          premium_net: number | null;
          taxes_fees: number | null;
          premium_gross: number;
          payment_frequency: PaymentFrequency;
          currency: string;
          commission_rate_percent: number | null;
          is_renewal: boolean;
          renewal_number: number;
          is_current_term: boolean;
          status_auto_managed: boolean;
          cancellation_reason: string | null;
          notes: string | null;
          extra_details: Record<string, unknown>;
          renewal_notice_30d_sent_at: string | null;
          renewal_notice_7d_sent_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["policies"]["Row"]> & {
          policy_number: string;
          client_id: string;
          carrier_id: string;
          insurance_line_id: string;
          start_date: string;
          end_date: string;
          premium_gross: number;
          payment_frequency: PaymentFrequency;
        };
        Update: Partial<Database["public"]["Tables"]["policies"]["Row"]>;
      };
      policy_visits: {
        Row: {
          id: string;
          policy_id: string;
          agency_user_id: string;
          visited_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["policy_visits"]["Row"]> & {
          policy_id: string;
          agency_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_visits"]["Row"]>;
      };
      policy_vehicle_details: {
        Row: {
          policy_id: string;
          plate_number: string | null;
          vin_chassis_number: string | null;
          make: string | null;
          model: string | null;
          manufacture_year: number | null;
          engine_cc: number | null;
          usage_type: VehicleUsage | null;
          kteo_expiry_date: string | null;
          insured_value: number | null;
          zone_code: string | null;
          insurance_package: string | null;
          driver_gender: string | null;
          horsepower: number | null;
          body_type: string | null;
          gross_weight_kg: number | null;
          manufacture_month: number | null;
          capacity_role: string | null;
          protection_measures: string | null;
          has_trailer: boolean;
          discount_percent: number | null;
          special_discount_percent: number | null;
          surcharge_percent: number | null;
          is_financed: boolean;
          title_retained: boolean;
          financing_bank: string | null;
          seats: number | null;
          manufacturer: string | null;
          required_license_type: string | null;
          color: string | null;
          engine_number: string | null;
          tonnage: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["policy_vehicle_details"]["Row"]> & {
          policy_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_vehicle_details"]["Row"]>;
      };
      policy_property_details: {
        Row: {
          policy_id: string;
          property_type: PropertyType | null;
          address_street: string | null;
          address_city: string | null;
          address_postal_code: string | null;
          kaek_number: string | null;
          construction_year: number | null;
          square_meters: number | null;
          commercial_value: number | null;
          has_alarm: boolean | null;
          occupancy_status: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["policy_property_details"]["Row"]> & {
          policy_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_property_details"]["Row"]>;
      };
      policy_life_health_details: {
        Row: {
          policy_id: string;
          coverage_type: string | null;
          sum_insured: number | null;
          deductible_amount: number | null;
          medical_exam_required: boolean | null;
          waiting_period_days: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["policy_life_health_details"]["Row"]> & {
          policy_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["policy_life_health_details"]["Row"]>;
      };
      policy_installments: {
        Row: {
          id: string;
          policy_id: string;
          installment_number: number;
          due_date: string;
          amount: number;
          status: PaymentStatus;
          paid_date: string | null;
          paid_amount: number | null;
          payment_method: string | null;
          receipt_number: string | null;
          payment_method_id: string | null;
          paid_by: string | null;
          paid_at: string | null;
          cancelled_by: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          movement_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["policy_installments"]["Row"]> & {
          policy_id: string;
          installment_number: number;
          due_date: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["policy_installments"]["Row"]>;
      };
      installment_payments: {
        Row: {
          id: string;
          installment_id: string;
          amount: number;
          payment_method_id: string | null;
          receipt_number: string | null;
          paid_by: string | null;
          paid_at: string;
          paid_date: string;
          is_reversed: boolean;
          reversed_by: string | null;
          reversed_at: string | null;
          reversal_reason: string | null;
          created_at: string;
          cheque_bank: string | null;
          cheque_number: string | null;
          cheque_due_date: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["installment_payments"]["Row"]> & {
          installment_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["installment_payments"]["Row"]>;
      };
      policy_movements: {
        Row: {
          id: string;
          policy_id: string;
          kind: PolicyMovementKind;
          document_number: string | null;
          application_number: string | null;
          issue_date: string;
          start_date: string;
          end_date: string;
          premium_net: number | null;
          premium_gross: number;
          insurance_package: string | null;
          description: string | null;
          outgoing_agent_id: string | null;
          notes: string | null;
          premium_remitted_at: string | null;
          outgoing_commission_remitted_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["policy_movements"]["Row"]> & {
          policy_id: string;
          kind: PolicyMovementKind;
          start_date: string;
          end_date: string;
          premium_gross: number;
        };
        Update: Partial<Database["public"]["Tables"]["policy_movements"]["Row"]>;
      };
      incoming_calls: {
        Row: {
          id: string;
          phone_number: string;
          client_id: string | null;
          client_name: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["incoming_calls"]["Row"]> & {
          phone_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["incoming_calls"]["Row"]>;
      };
      error_log: {
        Row: {
          id: string;
          context: string;
          message: string;
          stack: string | null;
          url: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["error_log"]["Row"]> & {
          context: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["error_log"]["Row"]>;
      };
      activity_log: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          description: string;
          actor_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activity_log"]["Row"]> & {
          entity_type: string;
          entity_id: string;
          action: string;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Row"]>;
      };
      email_templates: {
        Row: {
          id: string;
          key: string | null;
          name: string;
          subject: string;
          body: string;
          is_system: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_templates"]["Row"]> & {
          name: string;
          subject: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_templates"]["Row"]>;
      };
      app_settings: {
        Row: {
          key: string;
          enabled: boolean;
          value: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_settings"]["Row"]> & {
          key: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>;
      };
      client_celebrations_log: {
        Row: {
          id: string;
          client_id: string;
          celebration_type: string;
          celebration_date: string;
          task_id: string | null;
          email_sent: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_celebrations_log"]["Row"]> & {
          client_id: string;
          celebration_type: string;
          celebration_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_celebrations_log"]["Row"]>;
      };
      payment_methods: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]>;
      };
      commission_payees: {
        Row: {
          id: string;
          name: string;
          agency_user_id: string | null;
          is_external: boolean;
          phone: string | null;
          email: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commission_payees"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["commission_payees"]["Row"]>;
      };
      commissions: {
        Row: {
          id: string;
          policy_id: string;
          agent_id: string;
          carrier_id: string;
          policy_installment_id: string | null;
          commission_type: CommissionType;
          base_amount: number | null;
          commission_rate_percent: number | null;
          commission_amount: number;
          status: CommissionStatus;
          period: string | null;
          direction: CommissionDirection;
          payee_id: string | null;
          reference_rate_percent: number | null;
          reference_amount: number | null;
          is_manual_override: boolean;
          policy_movement_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commissions"]["Row"]> & {
          policy_id: string;
          agent_id: string;
          carrier_id: string;
          commission_type: CommissionType;
          commission_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["commissions"]["Row"]>;
      };
      referral_rewards: {
        Row: {
          id: string;
          referrer_client_id: string;
          referred_client_id: string;
          policy_id: string;
          calc_type: ReferralRewardCalcType;
          rate_percent: number | null;
          fixed_amount: number | null;
          base_amount: number;
          reward_amount: number;
          status: ReferralRewardStatus;
          paid_at: string | null;
          notes: string | null;
          source: ReferralRewardSource;
          policy_movement_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["referral_rewards"]["Row"]> & {
          referrer_client_id: string;
          referred_client_id: string;
          policy_id: string;
          calc_type: ReferralRewardCalcType;
          base_amount: number;
          reward_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["referral_rewards"]["Row"]>;
      };
      referral_reward_default_rule: {
        Row: {
          referrer_client_id: string;
          calc_type: ReferralRewardCalcType;
          rate_percent: number | null;
          fixed_amount: number | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["referral_reward_default_rule"]["Row"]> & {
          referrer_client_id: string;
          calc_type: ReferralRewardCalcType;
        };
        Update: Partial<Database["public"]["Tables"]["referral_reward_default_rule"]["Row"]>;
      };
      broker_offices: {
        Row: {
          id: string;
          name: string;
          is_direct: boolean;
          phone: string | null;
          email: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["broker_offices"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["broker_offices"]["Row"]>;
      };
      carrier_commission_rates: {
        Row: {
          id: string;
          broker_office_id: string | null;
          payee_id: string | null;
          agreement_id: string;
          carrier_id: string;
          insurance_line_id: string;
          default_commission_percent: number;
          valid_from: string;
          valid_to: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["carrier_commission_rates"]["Row"]> & {
          agreement_id: string;
          carrier_id: string;
          insurance_line_id: string;
          default_commission_percent: number;
        };
        Update: Partial<Database["public"]["Tables"]["carrier_commission_rates"]["Row"]>;
      };
      carrier_commission_defaults: {
        Row: {
          id: string;
          carrier_id: string;
          insurance_line_id: string;
          default_percent: number;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["carrier_commission_defaults"]["Row"]> & {
          carrier_id: string;
          insurance_line_id: string;
          default_percent: number;
        };
        Update: Partial<Database["public"]["Tables"]["carrier_commission_defaults"]["Row"]>;
      };
      commission_agreements: {
        Row: {
          id: string;
          broker_office_id: string | null;
          payee_id: string | null;
          direction: CommissionDirection;
          name: string;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commission_agreements"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["commission_agreements"]["Row"]>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          task_type: TaskType;
          assigned_to: string;
          client_id: string | null;
          policy_id: string | null;
          claim_id: string | null;
          due_date: string;
          status: TaskStatus;
          priority: TaskPriority;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          title: string;
          assigned_to: string;
          due_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
      };
    };
  };
}
