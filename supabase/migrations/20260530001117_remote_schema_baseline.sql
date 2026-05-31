


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, onboarding_state)
  values (new.id, 'pending')
  on conflict (id) do update set updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_geo_vocab"("search_term" "text", "target_country" "text" DEFAULT NULL::"text", "max_results" integer DEFAULT 12) RETURNS TABLE("id" bigint, "name" "text", "name_ja" "text", "level" "text", "country" "text", "parent_hint" "text", "similarity" real)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    g.id,
    g.name,
    g.name_ja,
    g.level,
    g.country,
    g.parent_hint,
    -- Calculate max similarity across all matching fields for better ranking
    greatest(
      similarity(g.name_norm, search_term),
      similarity(g.name_ja, search_term),
      similarity(g.name_ja_reading, search_term)
    )::real as sim
  from
    geo_vocab g
  where
    g.level in ('province', 'region_1', 'region_2')
    and (target_country is null or g.country = target_country)
    and (
      g.name_norm like search_term || '%'
      or g.name_norm % search_term
      or g.name_ja like '%' || search_term || '%'
      or g.name_ja_reading like '%' || search_term || '%'
    )
  order by
    -- Prioritize exact/prefix matches in any field
    (
        g.name_norm like search_term || '%'
        or g.name_ja like search_term || '%'
        or g.name_ja_reading like search_term || '%'
    ) desc,
    -- Then order by similarity
    greatest(
      similarity(g.name_norm, search_term),
      similarity(g.name_ja, search_term),
      similarity(g.name_ja_reading, search_term)
    ) desc,
    g.name asc
  limit max_results;
end;
$$;


ALTER FUNCTION "public"."search_geo_vocab"("search_term" "text", "target_country" "text", "max_results" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."geo_vocab" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "name_norm" "text" NOT NULL,
    "name_ja" "text",
    "name_ja_reading" "text",
    "level" "text",
    "country" "text",
    "parent_hint" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."geo_vocab" OWNER TO "postgres";


ALTER TABLE "public"."geo_vocab" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."geo_vocab_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "onboarding_state" "text" DEFAULT 'pending'::"text",
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasting_notes" (
    "id" bigint NOT NULL,
    "date" timestamp with time zone,
    "price" integer,
    "place" "text",
    "image_url" "text",
    "wine_name" "text",
    "producer" "text",
    "country" "text",
    "locality" "text",
    "region" "text",
    "main_variety" "text",
    "other_varieties" "text",
    "additional_info" "text",
    "vintage" "text",
    "wine_type" "text",
    "intensity" numeric,
    "rim_ratio" numeric,
    "clarity" "text",
    "brightness" "text",
    "sparkle_intensity" "text",
    "appearance_other" "text",
    "nose_intensity" numeric,
    "old_new_world" numeric,
    "fruits_maturity" "text",
    "aroma_neutrality" numeric,
    "aromas" "text"[],
    "oak_aroma" numeric,
    "aroma_other" "text",
    "sweetness" numeric,
    "acidity_score" numeric,
    "tannin_score" numeric,
    "body_score" numeric,
    "alcohol_abv" numeric,
    "finish_score" numeric,
    "palate_notes" "text",
    "rating" numeric,
    "notes" "text",
    "vivino_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sat_appearance_intensity" "text",
    "sat_nose_intensity" "text",
    "sat_development" "text",
    "sat_sweetness" "text",
    "sat_acidity" "text",
    "sat_tannin" "text",
    "sat_alcohol" "text",
    "sat_body" "text",
    "sat_finish" "text",
    "sat_quality" "text",
    "user_id" "uuid",
    "terroir_info" "text",
    "producer_philosophy" "text",
    "technical_details" "text",
    "vintage_analysis" "text",
    "search_result_tasting_note" "text",
    "status" "text" DEFAULT 'published'::"text",
    "importer" "text",
    "nose_condition" "text",
    "development" "text",
    "readiness" "text",
    "quality_score" numeric,
    "color" numeric,
    "locality_vocab_id" bigint,
    "reference_url" "text"
);


ALTER TABLE "public"."tasting_notes" OWNER TO "postgres";


ALTER TABLE "public"."tasting_notes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tasting_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."wine_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tasting_note_id" bigint NOT NULL,
    "url" "text" NOT NULL,
    "thumbnail_url" "text",
    "storage_path" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wine_images" OWNER TO "postgres";


ALTER TABLE ONLY "public"."geo_vocab"
    ADD CONSTRAINT "geo_vocab_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasting_notes"
    ADD CONSTRAINT "tasting_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wine_images"
    ADD CONSTRAINT "wine_images_pkey" PRIMARY KEY ("id");



CREATE INDEX "geo_vocab_country_idx" ON "public"."geo_vocab" USING "btree" ("country");



CREATE INDEX "geo_vocab_level_idx" ON "public"."geo_vocab" USING "btree" ("level");



CREATE INDEX "geo_vocab_name_ja_reading_trgm_idx" ON "public"."geo_vocab" USING "gin" ("name_ja_reading" "public"."gin_trgm_ops");



CREATE INDEX "geo_vocab_name_ja_trgm_idx" ON "public"."geo_vocab" USING "gin" ("name_ja" "public"."gin_trgm_ops");



CREATE INDEX "geo_vocab_name_norm_trgm_idx" ON "public"."geo_vocab" USING "gin" ("name_norm" "public"."gin_trgm_ops");



CREATE INDEX "idx_tasting_notes_user_id" ON "public"."tasting_notes" USING "btree" ("user_id");



CREATE INDEX "tasting_notes_locality_vocab_id_idx" ON "public"."tasting_notes" USING "btree" ("locality_vocab_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasting_notes"
    ADD CONSTRAINT "tasting_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."wine_images"
    ADD CONSTRAINT "wine_images_tasting_note_id_fkey" FOREIGN KEY ("tasting_note_id") REFERENCES "public"."tasting_notes"("id") ON DELETE CASCADE;


DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";


CREATE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE POLICY "Enable delete for authenticated users only" ON "public"."wine_images" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."wine_images" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Enable read access for all users" ON "public"."wine_images" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."wine_images" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Users can delete their own notes" ON "public"."tasting_notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own wine images" ON "public"."wine_images" FOR DELETE USING (("auth"."uid"() = ( SELECT "tasting_notes"."user_id"
   FROM "public"."tasting_notes"
  WHERE ("tasting_notes"."id" = "wine_images"."tasting_note_id"))));



CREATE POLICY "Users can insert their own notes" ON "public"."tasting_notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own wine images" ON "public"."wine_images" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "tasting_notes"."user_id"
   FROM "public"."tasting_notes"
  WHERE ("tasting_notes"."id" = "wine_images"."tasting_note_id"))));



CREATE POLICY "Users can select own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can select their own wine images" ON "public"."wine_images" FOR SELECT USING (("auth"."uid"() = ( SELECT "tasting_notes"."user_id"
   FROM "public"."tasting_notes"
  WHERE ("tasting_notes"."id" = "wine_images"."tasting_note_id"))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own notes" ON "public"."tasting_notes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own wine images" ON "public"."wine_images" FOR UPDATE USING (("auth"."uid"() = ( SELECT "tasting_notes"."user_id"
   FROM "public"."tasting_notes"
  WHERE ("tasting_notes"."id" = "wine_images"."tasting_note_id"))));



CREATE POLICY "Users can view their own notes" ON "public"."tasting_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."geo_vocab" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "geo_vocab_read_for_authenticated" ON "public"."geo_vocab" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasting_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wine_images" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_geo_vocab"("search_term" "text", "target_country" "text", "max_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_geo_vocab"("search_term" "text", "target_country" "text", "max_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_geo_vocab"("search_term" "text", "target_country" "text", "max_results" integer) TO "service_role";



GRANT ALL ON TABLE "public"."geo_vocab" TO "service_role";
GRANT SELECT ON TABLE "public"."geo_vocab" TO "anon";
GRANT SELECT ON TABLE "public"."geo_vocab" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."geo_vocab_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."geo_vocab_id_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."tasting_notes" TO "service_role";
GRANT SELECT ON TABLE "public"."tasting_notes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tasting_notes" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."tasting_notes_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."tasting_notes_id_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."wine_images" TO "service_role";
GRANT SELECT ON TABLE "public"."wine_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wine_images" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";





