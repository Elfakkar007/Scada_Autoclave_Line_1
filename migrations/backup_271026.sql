--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit_log_fill_actor_name(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_log_fill_actor_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.actor_name IS NULL AND NEW.actor IS NOT NULL THEN
        SELECT u.full_name INTO NEW.actor_name
        FROM public.users u
        WHERE u.username = NEW.actor;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_log_fill_actor_name() OWNER TO postgres;

--
-- Name: roles_block_system_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.roles_block_system_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.is_system THEN
        RAISE EXCEPTION 'Role sistem "%" tidak boleh dihapus', OLD.key
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
END;
$$;


ALTER FUNCTION public.roles_block_system_delete() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alarm_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alarm_log (
    id bigint NOT NULL,
    alarm_date timestamp with time zone,
    event_date timestamp with time zone,
    variable_name text,
    alarm_type text,
    alarm_value text,
    recovery_value text,
    limit_value text,
    event_type text,
    operator text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    episode_id uuid,
    alarm_key text,
    batch_no text,
    phase_code integer,
    description text
);


ALTER TABLE public.alarm_log OWNER TO postgres;

--
-- Name: alarm_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alarm_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alarm_log_id_seq OWNER TO postgres;

--
-- Name: alarm_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alarm_log_id_seq OWNED BY public.alarm_log.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    actor text,
    actor_role text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    old_value jsonb,
    new_value jsonb,
    source text DEFAULT 'web'::text NOT NULL,
    ip_address text,
    user_agent text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_name text
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: batch_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batch_records (
    id integer NOT NULL,
    batch_no text NOT NULL,
    loading_no text,
    operator text,
    machine_id text,
    recipe_id integer,
    product_name text,
    product_spec text,
    ctrl_type text,
    ster_temp numeric,
    cool_temp numeric,
    heat_begin timestamp with time zone,
    ster_begin timestamp with time zone,
    cool_begin timestamp with time zone,
    run_begin timestamp with time zone,
    run_finish timestamp with time zone,
    heat_time_min numeric,
    ster_time_min numeric,
    cool_time_min numeric,
    total_time_min numeric,
    fo1 numeric,
    fo2 numeric,
    fo3 numeric,
    fo4 numeric,
    fo5 numeric,
    fo6 numeric,
    foh numeric,
    fom numeric,
    fol numeric,
    status text DEFAULT 'running'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fo_min numeric,
    sterilization_result text,
    f0_meta jsonb,
    recipe_snapshot jsonb,
    operator_username text,
    CONSTRAINT batch_records_status_check CHECK ((status = ANY (ARRAY['running'::text, 'finished'::text, 'aborted'::text]))),
    CONSTRAINT batch_records_sterilization_result_check CHECK ((sterilization_result = ANY (ARRAY['pass'::text, 'fail'::text, 'pending'::text])))
);


ALTER TABLE public.batch_records OWNER TO postgres;

--
-- Name: COLUMN batch_records.recipe_snapshot; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.batch_records.recipe_snapshot IS 'Salinan nilai resep saat START (yang ditulis dan diverifikasi ke PLC). NULL = batch sebelum item 6.';


--
-- Name: COLUMN batch_records.operator_username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.batch_records.operator_username IS 'Username akun yang menekan START (dari sesi server). NULL = tidak diketahui (data lama, batch adopsi EXT-/system).';


--
-- Name: batch_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.batch_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.batch_records_id_seq OWNER TO postgres;

--
-- Name: batch_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.batch_records_id_seq OWNED BY public.batch_records.id;


--
-- Name: batch_trend; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batch_trend (
    id bigint NOT NULL,
    batch_id integer NOT NULL,
    ts timestamp with time zone NOT NULL,
    t1 numeric,
    t2 numeric,
    t3 numeric,
    t4 numeric,
    t5 numeric,
    t6 numeric,
    p numeric,
    th numeric,
    tm numeric,
    tl numeric,
    avg numeric,
    phase_code integer,
    cond numeric
);


ALTER TABLE public.batch_trend OWNER TO postgres;

--
-- Name: batch_trend_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.batch_trend_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.batch_trend_id_seq OWNER TO postgres;

--
-- Name: batch_trend_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.batch_trend_id_seq OWNED BY public.batch_trend.id;


--
-- Name: monitor_heartbeat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monitor_heartbeat (
    id smallint NOT NULL,
    beat_at timestamp with time zone NOT NULL,
    CONSTRAINT monitor_heartbeat_id_check CHECK ((id = 1))
);


ALTER TABLE public.monitor_heartbeat OWNER TO postgres;

--
-- Name: product_names; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_names (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_names OWNER TO postgres;

--
-- Name: product_names_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_names_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_names_id_seq OWNER TO postgres;

--
-- Name: product_names_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_names_id_seq OWNED BY public.product_names.id;


--
-- Name: product_specs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_specs (
    id integer NOT NULL,
    spec character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_specs OWNER TO postgres;

--
-- Name: product_specs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_specs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_specs_id_seq OWNER TO postgres;

--
-- Name: product_specs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_specs_id_seq OWNED BY public.product_specs.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    spec character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipes (
    id integer NOT NULL,
    formula_no text NOT NULL,
    control_temp numeric,
    space_temp numeric,
    steril_temp numeric,
    steril_time_min integer,
    alarm_pres numeric,
    cooling_temp1 numeric,
    cooling_temp2 numeric,
    fo_val_setting numeric,
    control_type text,
    steril_material text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recipes OWNER TO postgres;

--
-- Name: recipes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipes_id_seq OWNER TO postgres;

--
-- Name: recipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipes_id_seq OWNED BY public.recipes.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    resource text NOT NULL,
    level text NOT NULL,
    CONSTRAINT role_permissions_level_check CHECK ((level = ANY (ARRAY['none'::text, 'view'::text, 'edit'::text]))),
    CONSTRAINT role_permissions_resource_check CHECK ((resource ~ '^[a-z][a-z0-9_.]{1,63}$'::text))
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roles_key_check CHECK ((key ~ '^[a-z][a-z0-9_]{1,31}$'::text)),
    CONSTRAINT roles_name_check CHECK (((length(btrim(name)) >= 2) AND (length(btrim(name)) <= 60)))
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role_id integer,
    deleted_at timestamp with time zone,
    CONSTRAINT users_role_id_required_if_not_deleted CHECK (((deleted_at IS NOT NULL) OR (role_id IS NOT NULL)))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: alarm_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alarm_log ALTER COLUMN id SET DEFAULT nextval('public.alarm_log_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: batch_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_records ALTER COLUMN id SET DEFAULT nextval('public.batch_records_id_seq'::regclass);


--
-- Name: batch_trend id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_trend ALTER COLUMN id SET DEFAULT nextval('public.batch_trend_id_seq'::regclass);


--
-- Name: product_names id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_names ALTER COLUMN id SET DEFAULT nextval('public.product_names_id_seq'::regclass);


--
-- Name: product_specs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_specs ALTER COLUMN id SET DEFAULT nextval('public.product_specs_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: recipes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes ALTER COLUMN id SET DEFAULT nextval('public.recipes_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alarm_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alarm_log (id, alarm_date, event_date, variable_name, alarm_type, alarm_value, recovery_value, limit_value, event_type, operator, created_at, episode_id, alarm_key, batch_no, phase_code, description) FROM stdin;
1	2026-09-23 07:26:13.731261+07	2026-09-23 07:26:13.731261+07	T1	over_temp	125.4	121.0	124.0	high_temp_alarm	priza	2026-09-23 09:26:13.731261+07	\N	\N	\N	\N	\N
2	2026-09-23 07:56:13.731261+07	2026-09-23 07:56:13.731261+07	P1	over_pressure	245	238	240	high_pressure_alarm	priza	2026-09-23 09:26:13.731261+07	\N	\N	\N	\N	\N
3	2026-09-23 08:41:13.731261+07	2026-09-23 08:41:13.731261+07	\N	\N	\N	\N	\N	login	priza	2026-09-23 09:26:13.731261+07	\N	\N	\N	\N	\N
4	2026-09-23 08:46:13.731261+07	2026-09-23 08:46:13.731261+07	\N	\N	\N	\N	\N	start	priza	2026-09-23 09:26:13.731261+07	\N	\N	\N	\N	\N
5	2026-09-23 09:16:13.731261+07	2026-09-23 09:16:13.731261+07	\N	\N	\N	\N	\N	communication_abnormal	Hammam Al Fakkar	2026-09-23 09:26:13.731261+07	\N	\N	\N	\N	\N
6	\N	2026-10-08 10:05:28.716+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-08 10:05:28.895467+07	\N	\N	\N	\N	Server SCADA dimulai.
7	\N	2026-10-08 10:18:04.044+07	\N	\N	\N	\N	\N	monitor_gap	Hammam Al Fakkar	2026-10-08 10:18:04.166566+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 8/10/2026, 10.15.43 sampai 8/10/2026, 10.18.04 (sekitar 2 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
8	\N	2026-10-08 10:18:04.044+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-08 10:18:04.171932+07	\N	\N	\N	\N	Server SCADA dimulai.
9	\N	2026-10-08 10:18:54.227+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-08 10:18:54.321761+07	\N	\N	\N	\N	Server SCADA dimulai.
10	\N	2026-10-08 10:20:00.839+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-08 10:20:00.917951+07	\N	\N	\N	\N	Server SCADA dimulai.
11	\N	2026-10-08 10:55:06.038+07	\N	\N	\N	\N	\N	monitor_gap	Hammam Al Fakkar	2026-10-08 10:55:06.128624+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 8/10/2026, 10.54.07 sampai 8/10/2026, 10.55.06 (sekitar 1 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
12	\N	2026-10-08 10:55:06.038+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-08 10:55:06.13248+07	\N	\N	\N	\N	Server SCADA dimulai.
15	\N	2026-10-08 15:37:23.906+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-08 15:37:23.968765+07	\N	\N	\N	\N	Server SCADA dimulai.
16	\N	2026-10-10 07:23:08.378+07	\N	\N	\N	\N	\N	monitor_gap	Hammam Al Fakkar	2026-10-10 07:23:08.509908+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 10/10/2026, 07.21.16 sampai 10/10/2026, 07.23.08 (sekitar 2 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
17	\N	2026-10-10 07:23:08.378+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-10 07:23:08.531914+07	\N	\N	\N	\N	Server SCADA dimulai.
18	\N	2026-10-10 09:24:45.382+07	\N	\N	\N	\N	\N	communication_normal	Hammam Al Fakkar	2026-10-10 09:24:45.867086+07	\N	\N	\N	\N	Komunikasi PLC pulih (terputus sekitar 122 menit).
19	2026-10-10 09:55:17.029+07	\N	ALM_M10_2	Suhu steril di bawah setpoint	120.9	\N	121.0	alarm_active	Hammam Al Fakkar	2026-10-10 09:55:17.479782+07	00b9e15b-9fbd-4d60-8462-dcf607123a31	m10_2	\N	4	\N
20	2026-10-10 09:55:17.029+07	2026-10-10 09:55:40.161+07	ALM_M10_2	Suhu steril di bawah setpoint	120.9	\N	121.0	alarm_recovery	Hammam Al Fakkar	2026-10-10 09:55:50.694206+07	00b9e15b-9fbd-4d60-8462-dcf607123a31	m10_2	\N	4	\N
21	2026-10-10 09:58:06.17+07	\N	ALM_M10_3	Suhu steril melewati batas atas	124.1	\N	124.0	alarm_active	Hammam Al Fakkar	2026-10-10 09:58:06.59205+07	7e05c347-95ed-4ee5-b9c2-35b954f58b7d	m10_3	\N	4	\N
22	2026-10-10 09:58:06.17+07	2026-10-10 09:58:22.294+07	ALM_M10_3	Suhu steril melewati batas atas	124.1	\N	124.0	alarm_recovery	Hammam Al Fakkar	2026-10-10 09:58:32.754958+07	7e05c347-95ed-4ee5-b9c2-35b954f58b7d	m10_3	\N	4	\N
23	\N	2026-10-10 10:43:33.185+07	\N	\N	\N	\N	\N	communication_abnormal	Hammam Al Fakkar	2026-10-10 10:43:38.807504+07	\N	\N	\N	\N	Komunikasi dengan PLC terputus. Alarm tidak dapat dipantau selama ini.
24	\N	2026-10-10 11:17:08.983+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-10 11:17:09.15372+07	\N	\N	\N	\N	Server SCADA dimulai.
25	\N	2026-10-10 11:21:48.653+07	\N	\N	\N	\N	\N	communication_normal	Hammam Al Fakkar	2026-10-10 11:21:49.53525+07	\N	\N	\N	\N	Komunikasi PLC pulih (terputus sekitar 5 menit).
26	\N	2026-10-10 12:15:00.986+07	\N	\N	\N	\N	\N	communication_abnormal	Hammam Al Fakkar	2026-10-10 12:15:06.359242+07	\N	\N	\N	\N	Komunikasi dengan PLC terputus. Alarm tidak dapat dipantau selama ini.
27	\N	2026-10-11 07:04:43.664+07	\N	\N	\N	\N	\N	monitor_gap	Hammam Al Fakkar	2026-10-11 07:04:44.571178+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 10/10/2026, 13.41.17 sampai 11/10/2026, 07.04.43 (sekitar 1043 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
28	\N	2026-10-11 07:04:43.664+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-11 07:04:44.597693+07	\N	\N	\N	\N	Server SCADA dimulai.
29	\N	2026-10-12 16:25:40.278+07	\N	\N	\N	\N	\N	monitor_gap	Hammam Al Fakkar	2026-10-12 16:25:40.887848+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 11/10/2026, 07.04.54 sampai 12/10/2026, 16.25.40 (sekitar 2001 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
30	\N	2026-10-12 16:25:40.278+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-12 16:25:40.918051+07	\N	\N	\N	\N	Server SCADA dimulai.
31	\N	2026-10-13 07:43:28.408+07	\N	\N	\N	\N	\N	monitor_gap	Hammam Al Fakkar	2026-10-13 07:43:28.662913+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 12/10/2026, 16.56.14 sampai 13/10/2026, 07.43.28 (sekitar 887 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
32	\N	2026-10-13 07:43:28.408+07	\N	\N	\N	\N	\N	server_start	Hammam Al Fakkar	2026-10-13 07:43:28.669184+07	\N	\N	\N	\N	Server SCADA dimulai.
33	\N	2026-10-13 10:45:59.66+07	\N	\N	\N	\N	\N	communication_normal	Hammam Al Fakkar	2026-10-13 10:46:00.132166+07	\N	\N	\N	\N	Komunikasi PLC pulih (terputus sekitar 182 menit).
34	2026-10-13 11:16:39.163+07	\N	ALM_M10_3	Suhu steril melewati batas atas	124.1	\N	124.0	alarm_active	Hammam Al Fakkar	2026-10-13 11:16:39.736458+07	c8aad6f0-0170-4f4a-a672-53b16afa86e7	m10_3	KOSONGAN 13.10.26	4	\N
35	2026-10-13 11:16:39.163+07	2026-10-13 11:16:45.191+07	ALM_M10_3	Suhu steril melewati batas atas	124.1	\N	124.0	alarm_recovery	Hammam Al Fakkar	2026-10-13 11:16:56.168614+07	c8aad6f0-0170-4f4a-a672-53b16afa86e7	m10_3	KOSONGAN 13.10.26	4	\N
36	\N	2026-10-13 11:55:44.548+07	\N	\N	\N	\N	\N	communication_abnormal	Hammam Al Fakkar	2026-10-13 11:55:50.06222+07	\N	\N	\N	\N	Komunikasi dengan PLC terputus. Alarm tidak dapat dipantau selama ini.
37	\N	2026-10-14 16:42:34.039+07	\N	\N	\N	\N	\N	monitor_gap	\N	2026-10-14 16:42:34.559616+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 13/10/2026, 16.44.49 sampai 14/10/2026, 16.42.34 (sekitar 1438 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
38	\N	2026-10-14 16:42:34.039+07	\N	\N	\N	\N	\N	server_start	\N	2026-10-14 16:42:34.602294+07	\N	\N	\N	\N	Server SCADA dimulai.
39	\N	2026-10-15 09:32:46.87+07	\N	\N	\N	\N	\N	monitor_gap	\N	2026-10-15 09:32:47.261066+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 14/10/2026, 16.58.41 sampai 15/10/2026, 09.32.46 (sekitar 994 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
40	\N	2026-10-15 09:32:46.87+07	\N	\N	\N	\N	\N	server_start	\N	2026-10-15 09:32:47.300435+07	\N	\N	\N	\N	Server SCADA dimulai.
41	\N	2026-10-22 09:32:35.291+07	\N	\N	\N	\N	\N	monitor_gap	\N	2026-10-22 09:32:35.399643+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 15/10/2026, 16.56.03 sampai 22/10/2026, 09.32.35 (sekitar 9637 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
42	\N	2026-10-22 09:32:35.291+07	\N	\N	\N	\N	\N	server_start	\N	2026-10-22 09:32:35.413678+07	\N	\N	\N	\N	Server SCADA dimulai.
43	\N	2026-10-22 09:39:57.78+07	\N	\N	\N	\N	\N	monitor_gap	\N	2026-10-22 09:39:57.986129+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 22/10/2026, 09.33.45 sampai 22/10/2026, 09.39.57 (sekitar 6 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
44	\N	2026-10-22 09:39:57.78+07	\N	\N	\N	\N	\N	server_start	\N	2026-10-22 09:39:57.991372+07	\N	\N	\N	\N	Server SCADA dimulai.
45	\N	2026-10-26 14:23:20.81+07	\N	\N	\N	\N	\N	monitor_gap	\N	2026-10-26 14:23:21.230604+07	\N	\N	\N	\N	Pemantauan alarm terhenti dari 23/10/2026, 04.16.08 sampai 26/10/2026, 14.23.20 (sekitar 4927 menit). Alarm yang terjadi pada rentang ini TIDAK terekam.
46	\N	2026-10-26 14:23:20.81+07	\N	\N	\N	\N	\N	server_start	\N	2026-10-26 14:23:21.276421+07	\N	\N	\N	\N	Server SCADA dimulai.
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log (id, event_time, actor, actor_role, action, entity_type, entity_id, old_value, new_value, source, ip_address, user_agent, description, created_at, actor_name) FROM stdin;
68	2026-10-07 15:18:53.29585+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-07 15:18:53.29585+07	Wahyu Syahputra
74	2026-10-07 15:25:59.169581+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-07 15:25:59.169581+07	Wahyu Syahputra
3	2026-09-22 21:58:01.666431+07	unknown	\N	update	formula	134	{"id": 3, "alarmPres": 260, "createdAt": "2026-09-22T09:45:33.385Z", "formulaNo": "134", "spaceTemp": 0.8, "updatedAt": "2026-09-22T09:45:33.385Z", "sterilTemp": 134, "sterilTime": 4, "controlTemp": 134, "controlType": "Time", "coolingTemp1": 105, "coolingTemp2": 60, "foValSetting": 4, "sterilMaterial": "Soft bottle"}	{"id": 3, "alarmPres": 260, "createdAt": "2026-09-22T09:45:33.385Z", "formulaNo": "134", "spaceTemp": 0.8, "updatedAt": "2026-09-22T14:58:01.662Z", "sterilTemp": 134, "sterilTime": 1, "controlTemp": 134, "controlType": "Time", "coolingTemp1": 105, "coolingTemp2": 60, "foValSetting": 4, "sterilMaterial": "Soft bottle"}	web	\N	\N	Formula 134 diubah: steril_time_min dari 4 menjadi 1	2026-09-22 21:58:01.666431+07	\N
75	2026-10-07 15:26:44.00795+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 66}	web	\N	\N	Export audit log oleh Hammam: 66 baris, format=json	2026-10-07 15:26:44.00795+07	Hammam Al Fakkar
76	2026-10-07 15:26:44.16418+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 67}	web	\N	\N	Export audit log oleh Hammam: 67 baris, format=json	2026-10-07 15:26:44.16418+07	Hammam Al Fakkar
84	2026-10-07 15:47:19.72666+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 75}	web	\N	\N	Export audit log oleh Hammam: 75 baris, format=json	2026-10-07 15:47:19.72666+07	Hammam Al Fakkar
85	2026-10-07 15:47:19.782414+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 76}	web	\N	\N	Export audit log oleh Hammam: 76 baris, format=json	2026-10-07 15:47:19.782414+07	Hammam Al Fakkar
86	2026-10-07 15:47:25.755262+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 77}	web	\N	\N	Export audit log oleh Hammam: 77 baris, format=json	2026-10-07 15:47:25.755262+07	Hammam Al Fakkar
87	2026-10-07 15:47:25.800111+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 78}	web	\N	\N	Export audit log oleh Hammam: 78 baris, format=json	2026-10-07 15:47:25.800111+07	Hammam Al Fakkar
94	2026-10-07 15:55:07.639766+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 85}	web	\N	\N	Export audit log oleh Hammam: 85 baris, format=json	2026-10-07 15:55:07.639766+07	Hammam Al Fakkar
95	2026-10-07 15:55:07.689935+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 86}	web	\N	\N	Export audit log oleh Hammam: 86 baris, format=json	2026-10-07 15:55:07.689935+07	Hammam Al Fakkar
13	2026-09-23 11:35:55.63679+07	Bot	\N	start_batch	batch	092910	\N	{"batchNo": "092910", "operator": "Bot", "formulaNo": "115", "machineId": "0012", "productName": "WFI"}	web	\N	\N	Batch 092910 dimulai oleh Bot (Formula: 115)	2026-09-23 11:35:55.63679+07	\N
96	2026-10-07 15:55:12.048727+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 87}	web	\N	\N	Export audit log oleh Hammam: 87 baris, format=json	2026-10-07 15:55:12.048727+07	Hammam Al Fakkar
97	2026-10-07 15:55:12.086464+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 88}	web	\N	\N	Export audit log oleh Hammam: 88 baris, format=json	2026-10-07 15:55:12.086464+07	Hammam Al Fakkar
98	2026-10-07 15:55:16.479419+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 89}	web	\N	\N	Export audit log oleh Hammam: 89 baris, format=json	2026-10-07 15:55:16.479419+07	Hammam Al Fakkar
99	2026-10-07 15:55:16.515634+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 90}	web	\N	\N	Export audit log oleh Hammam: 90 baris, format=json	2026-10-07 15:55:16.515634+07	Hammam Al Fakkar
104	2026-10-08 10:05:55.889027+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-08 10:05:55.889027+07	Hammam Al Fakkar
107	2026-10-08 10:20:09.647474+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-08 10:20:09.647474+07	Hammam Al Fakkar
111	2026-10-09 09:06:54.114153+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 4}	web	\N	\N	Export batch records oleh Hammam: 4 baris, format=json	2026-10-09 09:06:54.114153+07	Hammam Al Fakkar
112	2026-10-09 09:06:54.17874+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 4}	web	\N	\N	Export batch records oleh Hammam: 4 baris, format=json	2026-10-09 09:06:54.17874+07	Hammam Al Fakkar
115	2026-10-09 14:46:09.669722+07	Hammam	admin	update_user	user	Operator	{"role": "operator", "fullName": "Operator", "isActive": false}	{"role": "operator", "fullName": "Operator", "isActive": true}	web	\N	\N	User Operator diperbarui oleh Hammam	2026-10-09 14:46:09.669722+07	Hammam Al Fakkar
116	2026-10-09 14:46:19.00936+07	Hammam	admin	reset_password	user	Hammam	\N	\N	web	\N	\N	Password user Hammam di-reset oleh Hammam	2026-10-09 14:46:19.00936+07	Hammam Al Fakkar
117	2026-10-09 14:46:22.862505+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-09 14:46:22.862505+07	Hammam Al Fakkar
118	2026-10-09 14:46:28.194832+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-09 14:46:28.194832+07	Hammam Al Fakkar
121	2026-10-10 06:43:37.998954+07	Hammam	\N	login_failed	user	Hammam	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "Hammam"	2026-10-10 06:43:37.998954+07	Hammam Al Fakkar
122	2026-10-10 06:43:44.319714+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-10 06:43:44.319714+07	Hammam Al Fakkar
125	2026-10-10 12:10:35.37388+07	Hammam	admin	stop_requested	batch	EXT 10.10.26 11.21	{"batchNo": "EXT 10.10.26 11.21", "plcPhaseBefore": 0}	\N	web	\N	\N	STOP diminta oleh Hammam untuk batch EXT 10.10.26 11.21 (fase PLC: 0); pulsa STOP akan dikirim	2026-10-10 12:10:35.37388+07	Hammam Al Fakkar
126	2026-10-10 12:10:38.467498+07	Hammam	admin	stop_batch	batch	EXT 10.10.26 11.21	{"batchNo": "EXT 10.10.26 11.21", "operator": "system", "runBegin": "2026-10-10T04:21:51.003Z"}	{"status": "finished", "plcPulse": {"wroteOn": true, "wroteOff": true}, "plcStuckRisk": false, "plcStopWritten": true}	web	\N	\N	Batch EXT 10.10.26 11.21 diselesaikan oleh Hammam. Status akhir: finished.	2026-10-10 12:10:38.467498+07	Hammam Al Fakkar
127	2026-10-11 07:05:00.925122+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-11 07:05:00.925122+07	Hammam Al Fakkar
128	2026-10-12 16:25:52.782209+07	Hammam	\N	login_failed	user	Hammam	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "Hammam"	2026-10-12 16:25:52.782209+07	Hammam Al Fakkar
129	2026-10-12 16:26:00.58227+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-12 16:26:00.58227+07	Hammam Al Fakkar
135	2026-10-13 07:51:24.575595+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 5}	web	\N	\N	Export batch records oleh Hammam: 5 baris, format=json	2026-10-13 07:51:24.575595+07	Hammam Al Fakkar
6	2026-09-23 10:15:46.085559+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-23 10:15:46.085559+07	Hammam Al Fakkar
69	2026-10-07 15:19:18.385695+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-07 15:19:18.385695+07	Wahyu Syahputra
77	2026-10-07 15:27:08.321684+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 68}	web	\N	\N	Export audit log oleh Hammam: 68 baris, format=json	2026-10-07 15:27:08.321684+07	Hammam Al Fakkar
78	2026-10-07 15:27:08.356049+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 69}	web	\N	\N	Export audit log oleh Hammam: 69 baris, format=json	2026-10-07 15:27:08.356049+07	Hammam Al Fakkar
79	2026-10-07 15:27:24.603675+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": "2026-10-07", "from": "2026-10-07", "format": "json", "rowCount": 24}	web	\N	\N	Export audit log oleh Hammam: 24 baris, format=json	2026-10-07 15:27:24.603675+07	Hammam Al Fakkar
80	2026-10-07 15:27:24.639244+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": "2026-10-07", "from": "2026-10-07", "format": "json", "rowCount": 25}	web	\N	\N	Export audit log oleh Hammam: 25 baris, format=json	2026-10-07 15:27:24.639244+07	Hammam Al Fakkar
88	2026-10-07 15:47:45.681215+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 79}	web	\N	\N	Export audit log oleh Hammam: 79 baris, format=json	2026-10-07 15:47:45.681215+07	Hammam Al Fakkar
89	2026-10-07 15:47:45.715517+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 80}	web	\N	\N	Export audit log oleh Hammam: 80 baris, format=json	2026-10-07 15:47:45.715517+07	Hammam Al Fakkar
100	2026-10-07 16:00:00.028145+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 91}	web	\N	\N	Export audit log oleh Hammam: 91 baris, format=json	2026-10-07 16:00:00.028145+07	Hammam Al Fakkar
101	2026-10-07 16:00:00.070084+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 92}	web	\N	\N	Export audit log oleh Hammam: 92 baris, format=json	2026-10-07 16:00:00.070084+07	Hammam Al Fakkar
105	2026-10-08 10:06:08.54754+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-08 10:06:08.54754+07	Hammam Al Fakkar
108	2026-10-08 16:13:33.992709+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-08 16:13:33.992709+07	Wahyu Syahputra
113	2026-10-09 14:15:42.045933+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-09 14:15:42.045933+07	Hammam Al Fakkar
119	2026-10-09 16:48:08.020938+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-09 16:48:08.020938+07	Hammam Al Fakkar
123	2026-10-10 07:12:55.368845+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-10 07:12:55.368845+07	Hammam Al Fakkar
130	2026-10-12 16:26:21.953646+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 121}	web	\N	\N	Export audit log oleh Hammam: 121 baris, format=json	2026-10-12 16:26:21.953646+07	Hammam Al Fakkar
7	2026-09-23 10:16:25.258544+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-23 10:16:25.258544+07	Hammam Al Fakkar
8	2026-09-23 10:17:32.617351+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-23 10:17:32.617351+07	Hammam Al Fakkar
9	2026-09-23 10:25:03.107551+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-09-23 10:25:03.107551+07	Hammam Al Fakkar
10	2026-09-23 10:25:34.990029+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-23 10:25:34.990029+07	Hammam Al Fakkar
11	2026-09-23 10:25:42.944677+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-09-23 10:25:42.944677+07	Hammam Al Fakkar
12	2026-09-23 10:39:01.519647+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-23 10:39:01.519647+07	Hammam Al Fakkar
14	2026-09-23 14:07:38.983091+07	Hammam	admin	stop_batch	batch	092910	{"batchNo": "092910", "operator": "Bot", "runBegin": "2026-09-23T04:35:55.624Z"}	\N	web	\N	\N	Batch 092910 diselesaikan oleh Hammam	2026-09-23 14:07:38.983091+07	Hammam Al Fakkar
15	2026-09-23 14:31:33.069666+07	Hammam	admin	create_user	user	Operator	\N	{"role": "operator", "fullName": "Operator", "username": "Operator"}	web	\N	\N	User Operator (operator) dibuat oleh Hammam	2026-09-23 14:31:33.069666+07	Hammam Al Fakkar
16	2026-09-23 14:32:00.110419+07	Operator	operator	login	user	Operator	\N	\N	web	\N	\N	User Operator login berhasil	2026-09-23 14:32:00.110419+07	Operator
17	2026-09-23 14:47:20.036529+07	Hammam	admin	deactivate_user	user	Operator	\N	\N	web	\N	\N	User Operator dinonaktifkan oleh Hammam	2026-09-23 14:47:20.036529+07	Hammam Al Fakkar
18	2026-09-23 14:47:37.559716+07	Operator	operator	logout	user	Operator	\N	\N	web	\N	\N	User Operator logout	2026-09-23 14:47:37.559716+07	Operator
19	2026-09-23 14:48:18.887056+07	Hammam	admin	update_user	user	Operator	{"role": "operator", "fullName": "Operator", "isActive": false}	{"role": "operator", "fullName": "Operator", "isActive": true}	web	\N	\N	User Operator diperbarui oleh Hammam	2026-09-23 14:48:18.887056+07	Hammam Al Fakkar
20	2026-09-23 14:48:29.638295+07	Operator	operator	login	user	Operator	\N	\N	web	\N	\N	User Operator login berhasil	2026-09-23 14:48:29.638295+07	Operator
61	2026-10-07 15:01:34.839352+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-07 15:01:34.839352+07	Wahyu Syahputra
131	2026-10-12 16:26:22.080596+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 122}	web	\N	\N	Export audit log oleh Hammam: 122 baris, format=json	2026-10-12 16:26:22.080596+07	Hammam Al Fakkar
132	2026-10-12 16:26:25.710042+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 123}	web	\N	\N	Export audit log oleh Hammam: 123 baris, format=json	2026-10-12 16:26:25.710042+07	Hammam Al Fakkar
133	2026-10-12 16:26:25.766764+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 124}	web	\N	\N	Export audit log oleh Hammam: 124 baris, format=json	2026-10-12 16:26:25.766764+07	Hammam Al Fakkar
136	2026-10-13 07:51:24.628654+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 5}	web	\N	\N	Export batch records oleh Hammam: 5 baris, format=json	2026-10-13 07:51:24.628654+07	Hammam Al Fakkar
138	2026-10-13 07:58:28.471687+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-13 07:58:28.471687+07	Hammam Al Fakkar
139	2026-10-13 10:53:40.51173+07	Hammam	admin	plc_setpoints_written	batch	KOSONGAN 13.10.26	\N	{"written": {"STER_SET": 1210, "ALRM_PRES": 240, "CTRL_TEMP": 1210, "COOL1_TEMP": 1000, "COOL2_TEMP": 550, "TEMP_SPACE": 6, "STER_SET_TIME": 15}, "readBack": {"sterSet": 121, "alrmPres": 240, "ctrlTemp": 121, "cool1Temp": 100, "cool2Temp": 55, "tempSpace": 0.6, "sterSetTime": 15}, "recipeId": 1, "formulaNo": "121", "recipeSnapshot": {"version": 1, "recipeId": 1, "alarmPres": 240, "formulaNo": "121", "spaceTemp": 0.6, "capturedAt": "2026-10-13T03:53:36.459Z", "sterilTemp": 121, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilTimeMin": 15, "sterilMaterial": "Soft bottle", "recipeUpdatedAt": "2026-10-07T04:36:32.954Z"}}	web	\N	\N	Setpoint formula 121 ditulis ke PLC dan terverifikasi oleh Hammam; START akan dikirim untuk batch KOSONGAN 13.10.26	2026-10-13 10:53:40.51173+07	Hammam Al Fakkar
145	2026-10-13 16:07:14.963176+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-13 16:07:14.963176+07	Hammam Al Fakkar
21	2026-09-23 14:48:34.620047+07	Hammam	admin	deactivate_user	user	Operator	\N	\N	web	\N	\N	User Operator dinonaktifkan oleh Hammam	2026-09-23 14:48:34.620047+07	Hammam Al Fakkar
22	2026-09-23 14:52:47.013386+07	Hammam	admin	reset_password	user	Operator	\N	\N	web	\N	\N	Password user Operator di-reset oleh Hammam	2026-09-23 14:52:47.013386+07	Hammam Al Fakkar
23	2026-09-23 14:52:56.421177+07	Operator	operator	logout	user	Operator	\N	\N	web	\N	\N	User Operator logout	2026-09-23 14:52:56.421177+07	Operator
24	2026-09-23 14:53:15.059349+07	Hammam	admin	update_user	user	Operator	{"role": "operator", "fullName": "Operator", "isActive": false}	{"role": "operator", "fullName": "Operator", "isActive": true}	web	\N	\N	User Operator diperbarui oleh Hammam	2026-09-23 14:53:15.059349+07	Hammam Al Fakkar
25	2026-09-23 14:53:18.371071+07	Operator	operator	login	user	Operator	\N	\N	web	\N	\N	User Operator login berhasil	2026-09-23 14:53:18.371071+07	Operator
26	2026-09-23 15:17:48.391161+07	Hammam	admin	create_user	user	operator	\N	{"role": "operator", "fullName": "operator", "username": "operator"}	web	\N	\N	User operator (operator) dibuat oleh Hammam	2026-09-23 15:17:48.391161+07	Hammam Al Fakkar
27	2026-09-23 15:18:08.604661+07	Hammam	admin	deactivate_user	user	Operator	\N	\N	web	\N	\N	User Operator dinonaktifkan oleh Hammam	2026-09-23 15:18:08.604661+07	Hammam Al Fakkar
28	2026-09-24 09:04:19.599396+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-24 09:04:19.599396+07	Hammam Al Fakkar
29	2026-09-25 07:57:02.414908+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-25 07:57:02.414908+07	Hammam Al Fakkar
30	2026-09-26 12:09:49.510927+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-26 12:09:49.510927+07	Hammam Al Fakkar
31	2026-09-29 09:19:32.120168+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-29 09:19:32.120168+07	Hammam Al Fakkar
32	2026-09-30 14:20:01.137262+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-09-30 14:20:01.137262+07	Hammam Al Fakkar
33	2026-10-01 13:44:47.790582+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-01 13:44:47.790582+07	Hammam Al Fakkar
38	2026-10-02 08:45:39.66948+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-02 08:45:39.66948+07	Hammam Al Fakkar
39	2026-10-02 10:54:35.588629+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "xlsx", "rowCount": 30}	web	\N	\N	Export audit log oleh Hammam: 30 baris, format=xlsx	2026-10-02 10:54:35.588629+07	Hammam Al Fakkar
40	2026-10-02 10:55:18.531918+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 31}	web	\N	\N	Export audit log oleh Hammam: 31 baris, format=json	2026-10-02 10:55:18.531918+07	Hammam Al Fakkar
41	2026-10-02 10:55:18.608071+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 32}	web	\N	\N	Export audit log oleh Hammam: 32 baris, format=json	2026-10-02 10:55:18.608071+07	Hammam Al Fakkar
42	2026-10-03 05:57:23.63514+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-03 05:57:23.63514+07	Hammam Al Fakkar
43	2026-10-03 05:57:26.193587+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-03 05:57:26.193587+07	Hammam Al Fakkar
44	2026-10-03 05:57:27.723212+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-03 05:57:27.723212+07	Hammam Al Fakkar
45	2026-10-03 05:57:28.769676+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-03 05:57:28.769676+07	Hammam Al Fakkar
46	2026-10-03 09:42:34.449921+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 37}	web	\N	\N	Export audit log oleh Hammam: 37 baris, format=json	2026-10-03 09:42:34.449921+07	Hammam Al Fakkar
47	2026-10-03 09:42:34.624594+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 38}	web	\N	\N	Export audit log oleh Hammam: 38 baris, format=json	2026-10-03 09:42:34.624594+07	Hammam Al Fakkar
48	2026-10-03 10:11:15.254019+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 39}	web	\N	\N	Export audit log oleh Hammam: 39 baris, format=json	2026-10-03 10:11:15.254019+07	Hammam Al Fakkar
49	2026-10-03 10:11:15.382718+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 40}	web	\N	\N	Export audit log oleh Hammam: 40 baris, format=json	2026-10-03 10:11:15.382718+07	Hammam Al Fakkar
50	2026-10-03 11:53:10.896058+07	Hammam	admin	stop_batch	batch	SIM-PRINT-001	{"batchNo": "SIM-PRINT-001", "operator": "tester", "runBegin": "2026-10-03T03:21:00.000Z"}	\N	web	\N	\N	Batch SIM-PRINT-001 diselesaikan oleh Hammam. Status akhir: finished	2026-10-03 11:53:10.896058+07	Hammam Al Fakkar
51	2026-10-03 14:25:43.545796+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-03 14:25:43.545796+07	Hammam Al Fakkar
52	2026-10-03 15:13:04.143963+07	Hammam	admin	update	formula	121	{"id": 1, "alarmPres": 240, "createdAt": "2026-09-22T09:45:33.385Z", "formulaNo": "121", "spaceTemp": 0.6, "updatedAt": "2026-09-22T09:45:33.385Z", "sterilTemp": 121, "sterilTime": 15, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilMaterial": "Soft bottle"}	{"id": 1, "alarmPres": 240, "createdAt": "2026-09-22T09:45:33.385Z", "formulaNo": "121", "spaceTemp": 0.6, "updatedAt": "2026-10-03T08:13:04.138Z", "sterilTemp": 121, "sterilTime": 15, "controlTemp": 121.5, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilMaterial": "Soft bottle"}	web	\N	\N	Formula 121 diubah oleh Hammam: control_temp dari 121 menjadi 121.5	2026-10-03 15:13:04.143963+07	Hammam Al Fakkar
53	2026-10-05 11:22:50.412677+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-05 11:22:50.412677+07	Hammam Al Fakkar
54	2026-10-06 09:02:28.568346+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-06 09:02:28.568346+07	Hammam Al Fakkar
55	2026-10-07 11:30:34.94723+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-07 11:30:34.94723+07	Hammam Al Fakkar
56	2026-10-07 11:36:32.954602+07	Hammam	admin	update	formula	121	{"id": 1, "alarmPres": 240, "createdAt": "2026-09-22T09:45:33.385Z", "formulaNo": "121", "spaceTemp": 0.6, "updatedAt": "2026-10-03T08:13:04.138Z", "sterilTemp": 121, "sterilTime": 15, "controlTemp": 121.5, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilMaterial": "Soft bottle"}	{"id": 1, "alarmPres": 240, "createdAt": "2026-09-22T09:45:33.385Z", "formulaNo": "121", "spaceTemp": 0.6, "updatedAt": "2026-10-07T04:36:32.954Z", "sterilTemp": 121, "sterilTime": 15, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilMaterial": "Soft bottle"}	web	\N	\N	Formula 121 diubah oleh Hammam: control_temp dari 121.5 menjadi 121	2026-10-07 11:36:32.954602+07	Hammam Al Fakkar
70	2026-10-07 15:24:11.629864+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-07 15:24:11.629864+07	Wahyu Syahputra
71	2026-10-07 15:24:53.356431+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-07 15:24:53.356431+07	Wahyu Syahputra
81	2026-10-07 15:28:11.138259+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-07 15:28:11.138259+07	Wahyu Syahputra
109	2026-10-08 16:16:10.697396+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-08 16:16:10.697396+07	Wahyu Syahputra
57	2026-10-07 11:37:46.742106+07	Hammam	admin	create	formula	test2	\N	{"id": 6, "alarmPres": 122, "createdAt": "2026-10-07T04:37:46.742Z", "formulaNo": "test2", "spaceTemp": 1, "updatedAt": "2026-10-07T04:37:46.742Z", "sterilTemp": 100, "sterilTime": 1, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 55, "coolingTemp2": 51, "foValSetting": 1, "sterilMaterial": "Soft bottle"}	web	\N	\N	Formula test2 dibuat oleh Hammam	2026-10-07 11:37:46.742106+07	Hammam Al Fakkar
58	2026-10-07 11:37:49.892456+07	Hammam	admin	delete	formula	test2	{"id": 6, "alarmPres": 122, "createdAt": "2026-10-07T04:37:46.742Z", "formulaNo": "test2", "spaceTemp": 1, "updatedAt": "2026-10-07T04:37:46.742Z", "sterilTemp": 100, "sterilTime": 1, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 55, "coolingTemp2": 51, "foValSetting": 1, "sterilMaterial": "Soft bottle"}	\N	web	\N	\N	Formula test2 dihapus oleh Hammam	2026-10-07 11:37:49.892456+07	Hammam Al Fakkar
59	2026-10-07 14:58:11.829947+07	Hammam	admin	create_user	user	wsa	\N	{"role": "operator", "fullName": "Wahyu Syahputra", "username": "wsa"}	web	\N	\N	User wsa (operator) dibuat oleh Hammam	2026-10-07 14:58:11.829947+07	Hammam Al Fakkar
60	2026-10-07 14:58:30.813942+07	wsa	operator	login	user	wsa	\N	\N	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	User wsa login berhasil	2026-10-07 14:58:30.813942+07	Wahyu Syahputra
62	2026-10-07 15:01:42.053502+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	Login gagal untuk username "wsa"	2026-10-07 15:01:42.053502+07	Wahyu Syahputra
63	2026-10-07 15:01:47.622106+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	Login gagal untuk username "wsa"	2026-10-07 15:01:47.622106+07	Wahyu Syahputra
64	2026-10-07 15:01:50.518716+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	Login gagal untuk username "wsa"	2026-10-07 15:01:50.518716+07	Wahyu Syahputra
65	2026-10-07 15:01:52.287846+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	Login gagal untuk username "wsa"	2026-10-07 15:01:52.287846+07	Wahyu Syahputra
66	2026-10-07 15:01:54.911411+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	Login gagal untuk username "wsa"	2026-10-07 15:01:54.911411+07	Wahyu Syahputra
67	2026-10-07 15:01:57.103578+07	wsa	\N	login_blocked	user	wsa	\N	{"scope": "username+ip", "windowMin": 15, "retryAfterSec": 885}	web	unknown	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	Login diblokir sementara (username+ip) setelah terlalu banyak percobaan gagal; username terakhir dicoba: wsa	2026-10-07 15:01:57.103578+07	Wahyu Syahputra
72	2026-10-07 15:25:08.522276+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-07 15:25:08.522276+07	Wahyu Syahputra
73	2026-10-07 15:25:46.136283+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-07 15:25:46.136283+07	Wahyu Syahputra
82	2026-10-07 15:42:30.053706+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 73}	web	\N	\N	Export audit log oleh Hammam: 73 baris, format=json	2026-10-07 15:42:30.053706+07	Hammam Al Fakkar
83	2026-10-07 15:42:30.185311+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 74}	web	\N	\N	Export audit log oleh Hammam: 74 baris, format=json	2026-10-07 15:42:30.185311+07	Hammam Al Fakkar
90	2026-10-07 15:50:58.915269+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 81}	web	\N	\N	Export audit log oleh Hammam: 81 baris, format=json	2026-10-07 15:50:58.915269+07	Hammam Al Fakkar
91	2026-10-07 15:50:58.969106+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 82}	web	\N	\N	Export audit log oleh Hammam: 82 baris, format=json	2026-10-07 15:50:58.969106+07	Hammam Al Fakkar
92	2026-10-07 15:51:04.790622+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 83}	web	\N	\N	Export audit log oleh Hammam: 83 baris, format=json	2026-10-07 15:51:04.790622+07	Hammam Al Fakkar
93	2026-10-07 15:51:04.854627+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 84}	web	\N	\N	Export audit log oleh Hammam: 84 baris, format=json	2026-10-07 15:51:04.854627+07	Hammam Al Fakkar
102	2026-10-07 16:30:03.949122+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 93}	web	\N	\N	Export audit log oleh Hammam: 93 baris, format=json	2026-10-07 16:30:03.949122+07	Hammam Al Fakkar
103	2026-10-07 16:30:04.059377+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 94}	web	\N	\N	Export audit log oleh Hammam: 94 baris, format=json	2026-10-07 16:30:04.059377+07	Hammam Al Fakkar
106	2026-10-08 10:18:27.863983+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-08 10:18:27.863983+07	Hammam Al Fakkar
110	2026-10-09 09:03:16.737362+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-09 09:03:16.737362+07	Hammam Al Fakkar
114	2026-10-09 14:45:54.87166+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-09 14:45:54.87166+07	Hammam Al Fakkar
120	2026-10-09 16:48:22.306678+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-09 16:48:22.306678+07	Hammam Al Fakkar
124	2026-10-10 11:21:51.009285+07	system	system	batch_adopted	batch	EXT 10.10.26 11.21	\N	{"source": "plc_readback", "batchNo": "EXT 10.10.26 11.21", "plcPhase": 4, "recipeSnapshot": {"source": "plc_readback", "version": 1, "recipeId": null, "alarmPres": 240, "formulaNo": null, "spaceTemp": 0.6, "capturedAt": "2026-10-10T04:21:50.999Z", "sterilTemp": 121, "controlTemp": 121.5, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 53, "foValSetting": null, "sterilTimeMin": 15, "adoptedAtPhase": 4, "sterilMaterial": null}}	system	\N	\N	Batch EXT 10.10.26 11.21 dibuat otomatis: proses ditemukan sudah berjalan di fase 4 tanpa batch di web.	2026-10-10 11:21:51.009285+07	\N
134	2026-10-13 07:51:16.304903+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-13 07:51:16.304903+07	Hammam Al Fakkar
137	2026-10-13 07:58:07.415+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-13 07:58:07.415+07	Hammam Al Fakkar
141	2026-10-13 11:48:37.003145+07	Hammam	admin	stop_requested	batch	KOSONGAN 13.10.26	{"batchNo": "KOSONGAN 13.10.26", "plcPhaseBefore": 6}	\N	web	\N	\N	STOP diminta oleh Hammam untuk batch KOSONGAN 13.10.26 (fase PLC: 6); pulsa STOP akan dikirim	2026-10-13 11:48:37.003145+07	Hammam Al Fakkar
143	2026-10-13 14:34:35.782117+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": "2026-10-13", "from": "2026-10-13", "format": "json", "rowCount": 9}	web	\N	\N	Export audit log oleh Hammam: 9 baris, format=json	2026-10-13 14:34:35.782117+07	Hammam Al Fakkar
147	2026-10-13 16:22:14.298228+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-13 16:22:14.298228+07	Hammam Al Fakkar
140	2026-10-13 10:53:43.775085+07	Hammam	admin	start_batch	batch	KOSONGAN 13.10.26	\N	{"batchNo": "KOSONGAN 13.10.26", "emptyRun": true, "operator": "Hammam Al Fakkar", "formulaNo": "121", "machineId": "SG-40", "productName": "-", "recipeSnapshot": {"version": 1, "recipeId": 1, "alarmPres": 240, "formulaNo": "121", "spaceTemp": 0.6, "capturedAt": "2026-10-13T03:53:36.459Z", "sterilTemp": 121, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilTimeMin": 15, "sterilMaterial": "Soft bottle", "recipeUpdatedAt": "2026-10-07T04:36:32.954Z"}}	web	\N	\N	Batch KOSONGAN 13.10.26 (run kosongan) dimulai oleh Hammam (Formula: 121) | Setpoint & START berhasil ditulis ke PLC, fase terkonfirmasi	2026-10-13 10:53:43.775085+07	Hammam Al Fakkar
142	2026-10-13 11:48:39.676161+07	Hammam	admin	stop_batch	batch	KOSONGAN 13.10.26	{"batchNo": "KOSONGAN 13.10.26", "operator": "Hammam Al Fakkar", "runBegin": "2026-10-13T03:53:43.744Z"}	{"status": "finished", "plcPulse": {"wroteOn": true, "wroteOff": true}, "plcStuckRisk": false, "plcStopWritten": true}	web	\N	\N	Batch KOSONGAN 13.10.26 diselesaikan oleh Hammam. Status akhir: finished.	2026-10-13 11:48:39.676161+07	Hammam Al Fakkar
144	2026-10-13 14:34:35.833733+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": "2026-10-13", "from": "2026-10-13", "format": "json", "rowCount": 10}	web	\N	\N	Export audit log oleh Hammam: 10 baris, format=json	2026-10-13 14:34:35.833733+07	Hammam Al Fakkar
146	2026-10-13 16:22:01.603223+07	Hammam	\N	login_failed	user	Hammam	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "Hammam"	2026-10-13 16:22:01.603223+07	Hammam Al Fakkar
148	2026-10-14 16:43:14.987069+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-14 16:43:14.987069+07	Hammam Al Fakkar
149	2026-10-14 16:50:57.323522+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-14 16:50:57.323522+07	Hammam Al Fakkar
150	2026-10-14 16:51:06.934088+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-14 16:51:06.934088+07	Hammam Al Fakkar
151	2026-10-15 09:33:51.40087+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-15 09:33:51.40087+07	Hammam Al Fakkar
152	2026-10-15 09:42:56.950443+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 09:42:56.950443+07	Hammam Al Fakkar
153	2026-10-15 10:31:52.221523+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-15 10:31:52.221523+07	Hammam Al Fakkar
154	2026-10-15 10:32:00.590092+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-15 10:32:00.590092+07	Hammam Al Fakkar
155	2026-10-15 10:48:13.528884+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 10:48:13.528884+07	Hammam Al Fakkar
156	2026-10-15 13:14:45.517597+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 13:14:45.517597+07	Hammam Al Fakkar
157	2026-10-15 13:22:54.215078+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 6}	web	\N	\N	Export batch records oleh Hammam: 6 baris, format=json	2026-10-15 13:22:54.215078+07	Hammam Al Fakkar
158	2026-10-15 13:22:54.333047+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 6}	web	\N	\N	Export batch records oleh Hammam: 6 baris, format=json	2026-10-15 13:22:54.333047+07	Hammam Al Fakkar
159	2026-10-15 13:25:25.626539+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 6}	web	\N	\N	Export batch records oleh Hammam: 6 baris, format=json	2026-10-15 13:25:25.626539+07	Hammam Al Fakkar
160	2026-10-15 13:25:25.684475+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 6}	web	\N	\N	Export batch records oleh Hammam: 6 baris, format=json	2026-10-15 13:25:25.684475+07	Hammam Al Fakkar
161	2026-10-15 13:38:54.219034+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 6}	web	\N	\N	Export batch records oleh Hammam: 6 baris, format=json	2026-10-15 13:38:54.219034+07	Hammam Al Fakkar
162	2026-10-15 13:38:54.284273+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": null, "from": null, "format": "json", "rowCount": 6}	web	\N	\N	Export batch records oleh Hammam: 6 baris, format=json	2026-10-15 13:38:54.284273+07	Hammam Al Fakkar
163	2026-10-15 13:50:26.311308+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 13:50:26.311308+07	Hammam Al Fakkar
164	2026-10-15 15:08:52.623726+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 15:08:52.623726+07	Hammam Al Fakkar
165	2026-10-15 15:37:23.087609+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 15:37:23.087609+07	Hammam Al Fakkar
166	2026-10-15 15:50:24.593554+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 15:50:24.593554+07	Hammam Al Fakkar
167	2026-10-15 16:23:03.069036+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 16:23:03.069036+07	Hammam Al Fakkar
168	2026-10-15 16:32:29.985747+07	Hammam	admin	update_product_spec	product_spec	3	{"spec": "100 ml Soft Bag", "isActive": true}	{"spec": "100 ml Soft Bag", "isActive": false}	web	\N	\N	Spesifikasi kemasan "100 ml Soft Bag" diubah oleh Hammam [status aktif: false]	2026-10-15 16:32:29.985747+07	Hammam Al Fakkar
169	2026-10-15 16:32:31.804608+07	Hammam	admin	update_product_spec	product_spec	3	{"spec": "100 ml Soft Bag", "isActive": false}	{"spec": "100 ml Soft Bag", "isActive": true}	web	\N	\N	Spesifikasi kemasan "100 ml Soft Bag" diubah oleh Hammam [status aktif: true]	2026-10-15 16:32:31.804608+07	Hammam Al Fakkar
170	2026-10-15 16:32:41.356397+07	Hammam	admin	update_product_spec	product_spec	3	{"spec": "100 ml Soft Bag", "isActive": true}	{"spec": "100 ml", "isActive": true}	web	\N	\N	Spesifikasi kemasan "100 ml" diubah oleh Hammam	2026-10-15 16:32:41.356397+07	Hammam Al Fakkar
171	2026-10-15 16:32:50.838561+07	Hammam	admin	update_product_spec	product_spec	2	{"spec": "1000 ml Bottle", "isActive": true}	{"spec": "1000", "isActive": true}	web	\N	\N	Spesifikasi kemasan "1000" diubah oleh Hammam	2026-10-15 16:32:50.838561+07	Hammam Al Fakkar
172	2026-10-15 16:32:56.499833+07	Hammam	admin	update_product_spec	product_spec	4	{"spec": "250 ml Bottle", "isActive": true}	{"spec": "250", "isActive": true}	web	\N	\N	Spesifikasi kemasan "250" diubah oleh Hammam	2026-10-15 16:32:56.499833+07	Hammam Al Fakkar
173	2026-10-15 16:33:05.046016+07	Hammam	admin	update_product_spec	product_spec	1	{"spec": "500 ml Soft Bag", "isActive": true}	{"spec": "500", "isActive": true}	web	\N	\N	Spesifikasi kemasan "500" diubah oleh Hammam	2026-10-15 16:33:05.046016+07	Hammam Al Fakkar
174	2026-10-15 16:33:15.97065+07	Hammam	admin	update_product_spec	product_spec	2	{"spec": "1000", "isActive": true}	{"spec": "1000 ml", "isActive": true}	web	\N	\N	Spesifikasi kemasan "1000 ml" diubah oleh Hammam	2026-10-15 16:33:15.97065+07	Hammam Al Fakkar
175	2026-10-15 16:33:21.397203+07	Hammam	admin	update_product_spec	product_spec	4	{"spec": "250", "isActive": true}	{"spec": "250 ml", "isActive": true}	web	\N	\N	Spesifikasi kemasan "250 ml" diubah oleh Hammam	2026-10-15 16:33:21.397203+07	Hammam Al Fakkar
176	2026-10-15 16:33:27.272323+07	Hammam	admin	update_product_spec	product_spec	1	{"spec": "500", "isActive": true}	{"spec": "500 ml", "isActive": true}	web	\N	\N	Spesifikasi kemasan "500 ml" diubah oleh Hammam	2026-10-15 16:33:27.272323+07	Hammam Al Fakkar
177	2026-10-15 16:35:27.455802+07	Hammam	admin	create_product_name	product_name	6	\N	{"name": "N/A", "isActive": true}	web	\N	\N	Nama produk "N/A" dibuat oleh Hammam	2026-10-15 16:35:27.455802+07	Hammam Al Fakkar
178	2026-10-15 16:43:22.718544+07	Hammam	admin	delete_product_name	product_name	3	{"name": "Dextrose 5%", "isActive": true}	\N	web	\N	\N	Nama produk "Dextrose 5%" dihapus oleh Hammam	2026-10-15 16:43:22.718544+07	Hammam Al Fakkar
179	2026-10-15 16:43:26.284445+07	Hammam	admin	delete_product_name	product_name	5	{"name": "Paracetamol Infus", "isActive": true}	\N	web	\N	\N	Nama produk "Paracetamol Infus" dihapus oleh Hammam	2026-10-15 16:43:26.284445+07	Hammam Al Fakkar
180	2026-10-15 16:43:30.050325+07	Hammam	admin	delete_product_name	product_name	1	{"name": "Ringer Lactate", "isActive": true}	\N	web	\N	\N	Nama produk "Ringer Lactate" dihapus oleh Hammam	2026-10-15 16:43:30.050325+07	Hammam Al Fakkar
181	2026-10-15 16:43:32.654812+07	Hammam	admin	delete_product_name	product_name	2	{"name": "Sodium Chloride 0.9%", "isActive": true}	\N	web	\N	\N	Nama produk "Sodium Chloride 0.9%" dihapus oleh Hammam	2026-10-15 16:43:32.654812+07	Hammam Al Fakkar
182	2026-10-15 16:43:36.701583+07	Hammam	admin	delete_product_name	product_name	4	{"name": "Water For Injection", "isActive": true}	\N	web	\N	\N	Nama produk "Water For Injection" dihapus oleh Hammam	2026-10-15 16:43:36.701583+07	Hammam Al Fakkar
183	2026-10-15 16:50:56.618183+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-15 16:50:56.618183+07	Hammam Al Fakkar
184	2026-10-22 09:41:02.987965+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-22 09:41:02.987965+07	Hammam Al Fakkar
185	2026-10-22 09:45:49.329472+07	Hammam	admin	reset_password	user	wsa	\N	\N	web	\N	\N	Password user wsa di-reset oleh Hammam	2026-10-22 09:45:49.329472+07	Hammam Al Fakkar
186	2026-10-22 09:45:53.548058+07	Hammam	admin	logout	user	Hammam	\N	\N	web	\N	\N	User Hammam logout	2026-10-22 09:45:53.548058+07	Hammam Al Fakkar
187	2026-10-22 09:46:02.741516+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-22 09:46:02.741516+07	Wahyu Syahputra
188	2026-10-22 10:14:52.503685+07	wsa	operator	unlock_screen	user	wsa	\N	\N	web	\N	\N	Layar dibuka kembali oleh Wahyu Syahputra (wsa)	2026-10-22 10:14:52.503685+07	Wahyu Syahputra
189	2026-10-22 10:14:53.902501+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-22 10:14:53.902501+07	Wahyu Syahputra
190	2026-10-22 10:14:59.828236+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-22 10:14:59.828236+07	Wahyu Syahputra
191	2026-10-22 10:46:30.511252+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-22 10:46:30.511252+07	Hammam Al Fakkar
192	2026-10-22 10:55:41.105374+07	Hammam	admin	role_create	role	test	\N	{"key": "test", "name": "test", "description": null, "permissions": {"alarm": "none", "roles": "none", "trend": "none", "users": "none", "formula": "none", "products": "none", "audit_log": "none", "dashboard": "none", "plc_clock": "none", "calibration": "none", "data_report": "none", "machine_params": "none", "manual_control": "none", "action.batch_control": "none", "action.write_calibration": "none", "action.write_safety_params": "none"}}	web	\N	\N	Role test dibuat oleh Hammam	2026-10-22 10:55:41.105374+07	Hammam Al Fakkar
193	2026-10-22 10:55:58.568013+07	Hammam	admin	role_permissions_update	role	test	{"dashboard": "none"}	{"dashboard": "view"}	web	\N	\N	Izin role test diubah oleh Hammam (1 resource)	2026-10-22 10:55:58.568013+07	Hammam Al Fakkar
194	2026-10-22 10:56:47.219833+07	Hammam	admin	create_user	user	fajri	\N	{"role": "test", "roleId": 5, "fullName": "fajri autoclave", "username": "fajri"}	web	\N	\N	User fajri (test) dibuat oleh Hammam	2026-10-22 10:56:47.219833+07	Hammam Al Fakkar
195	2026-10-22 10:57:02.55505+07	wsa	operator	unlock_screen_failed	user	wsa	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "wsa" (password salah)	2026-10-22 10:57:02.55505+07	Wahyu Syahputra
196	2026-10-22 10:57:11.255764+07	wsa	operator	unlock_screen	user	wsa	\N	\N	web	\N	\N	Layar dibuka kembali oleh Wahyu Syahputra (wsa)	2026-10-22 10:57:11.255764+07	Wahyu Syahputra
197	2026-10-22 10:57:13.392694+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-22 10:57:13.392694+07	Wahyu Syahputra
198	2026-10-22 10:57:27.000847+07	fajri	test	login	user	fajri	\N	\N	web	\N	\N	User fajri login berhasil	2026-10-22 10:57:27.000847+07	fajri autoclave
199	2026-10-22 11:10:09.9764+07	fajri	test	unlock_screen	user	fajri	\N	\N	web	\N	\N	Layar dibuka kembali oleh fajri autoclave (fajri)	2026-10-22 11:10:09.9764+07	fajri autoclave
200	2026-10-22 13:37:15.775898+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-22 13:37:15.775898+07	Hammam Al Fakkar
201	2026-10-22 13:37:34.432067+07	Hammam	admin	deactivate_user	user	operator	\N	\N	web	\N	\N	User operator dinonaktifkan oleh Hammam	2026-10-22 13:37:34.432067+07	Hammam Al Fakkar
202	2026-10-22 13:37:34.942234+07	Hammam	admin	update_user	user	operator	{"role": "operator", "fullName": "operator", "isActive": false}	{"role": "operator", "fullName": "operator", "isActive": true}	web	\N	\N	User operator diperbarui oleh Hammam	2026-10-22 13:37:34.942234+07	Hammam Al Fakkar
203	2026-10-22 13:37:37.880782+07	Hammam	admin	deactivate_user	user	operator	\N	\N	web	\N	\N	User operator dinonaktifkan oleh Hammam	2026-10-22 13:37:37.880782+07	Hammam Al Fakkar
204	2026-10-22 13:37:40.489856+07	Hammam	admin	deactivate_user	user	Operator	\N	\N	web	\N	\N	User Operator dinonaktifkan oleh Hammam	2026-10-22 13:37:40.489856+07	Hammam Al Fakkar
205	2026-10-22 13:38:47.012798+07	Hammam	admin	deactivate_user	user	fajri	\N	\N	web	\N	\N	User fajri dinonaktifkan oleh Hammam	2026-10-22 13:38:47.012798+07	Hammam Al Fakkar
206	2026-10-22 14:43:18.517983+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-22 14:43:18.517983+07	Hammam Al Fakkar
207	2026-10-22 14:43:23.509476+07	Hammam	admin	update_user	user	fajri	{"role": "test", "fullName": "fajri autoclave", "isActive": false}	{"role": "test", "fullName": "fajri autoclave", "isActive": true}	web	\N	\N	User fajri diperbarui oleh Hammam	2026-10-22 14:43:23.509476+07	Hammam Al Fakkar
208	2026-10-22 14:43:41.410028+07	fajri	test	login	user	fajri	\N	\N	web	\N	\N	User fajri login berhasil	2026-10-22 14:43:41.410028+07	fajri autoclave
209	2026-10-22 14:46:22.70481+07	Hammam	admin	role_permissions_update	role	test	{"dashboard": "view"}	{"dashboard": "edit"}	web	\N	\N	Izin role test diubah oleh Hammam (1 resource)	2026-10-22 14:46:22.70481+07	Hammam Al Fakkar
210	2026-10-22 14:46:47.484555+07	fajri	test	logout	user	fajri	\N	\N	web	\N	\N	User fajri logout	2026-10-22 14:46:47.484555+07	fajri autoclave
211	2026-10-22 14:46:57.350254+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-22 14:46:57.350254+07	Wahyu Syahputra
212	2026-10-22 15:22:59.361341+07	wsa	operator	unlock_screen	user	wsa	\N	\N	web	\N	\N	Layar dibuka kembali oleh Wahyu Syahputra (wsa)	2026-10-22 15:22:59.361341+07	Wahyu Syahputra
213	2026-10-22 15:23:01.943907+07	wsa	operator	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-22 15:23:01.943907+07	Wahyu Syahputra
214	2026-10-22 15:23:07.26919+07	fajri	\N	login_failed	user	fajri	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "fajri"	2026-10-22 15:23:07.26919+07	fajri autoclave
215	2026-10-22 15:23:11.00945+07	fajri	test	login	user	fajri	\N	\N	web	\N	\N	User fajri login berhasil	2026-10-22 15:23:11.00945+07	fajri autoclave
216	2026-10-22 15:24:46.814177+07	fajri	test	logout	user	fajri	\N	\N	web	\N	\N	User fajri logout	2026-10-22 15:24:46.814177+07	fajri autoclave
217	2026-10-22 16:12:19.337095+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-22 16:12:19.337095+07	Hammam Al Fakkar
218	2026-10-22 16:12:44.659022+07	Hammam	admin	delete_user	user	fajri	{"roleKey": "test", "fullName": "fajri autoclave", "isActive": true, "roleName": "test", "role_key": "test", "username": "fajri", "full_name": "fajri autoclave", "is_active": true, "role_name": "test"}	\N	web	\N	\N	User fajri (test) dihapus secara permanen oleh Hammam	2026-10-22 16:12:44.659022+07	Hammam Al Fakkar
219	2026-10-22 16:13:54.779379+07	fajri	\N	login_failed	user	fajri	\N	{"reason": "unknown_or_inactive_user"}	web	\N	\N	Login gagal untuk username "fajri"	2026-10-22 16:13:54.779379+07	fajri autoclave
220	2026-10-22 16:13:58.640214+07	fajri	\N	login_failed	user	fajri	\N	{"reason": "unknown_or_inactive_user"}	web	\N	\N	Login gagal untuk username "fajri"	2026-10-22 16:13:58.640214+07	fajri autoclave
221	2026-10-22 16:14:03.970553+07	fajri	\N	login_failed	user	fajri	\N	{"reason": "unknown_or_inactive_user"}	web	\N	\N	Login gagal untuk username "fajri"	2026-10-22 16:14:03.970553+07	fajri autoclave
222	2026-10-22 16:14:10.382432+07	fajri	\N	login_failed	user	fajri	\N	{"reason": "unknown_or_inactive_user"}	web	\N	\N	Login gagal untuk username "fajri"	2026-10-22 16:14:10.382432+07	fajri autoclave
223	2026-10-22 16:14:35.835332+07	Hammam	admin	delete_user	user	operator	{"roleKey": "operator", "fullName": "operator", "isActive": false, "roleName": "Operator", "role_key": "operator", "username": "operator", "full_name": "operator", "is_active": false, "role_name": "Operator"}	\N	web	\N	\N	User operator (Operator) dihapus secara permanen oleh Hammam	2026-10-22 16:14:35.835332+07	Hammam Al Fakkar
224	2026-10-22 16:14:39.873002+07	Hammam	admin	delete_user	user	Operator	{"roleKey": "operator", "fullName": "Operator", "isActive": false, "roleName": "Operator", "role_key": "operator", "username": "Operator", "full_name": "Operator", "is_active": false, "role_name": "Operator"}	\N	web	\N	\N	User Operator (Operator) dihapus secara permanen oleh Hammam	2026-10-22 16:14:39.873002+07	Hammam Al Fakkar
225	2026-10-22 16:41:32.028414+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-22 16:41:32.028414+07	Hammam Al Fakkar
226	2026-10-22 16:41:52.107541+07	Hammam	admin	create_user	user	qa	\N	{"role": "qa", "roleId": 3, "fullName": "uji_qa", "username": "qa"}	web	\N	\N	User qa (QA) dibuat oleh Hammam	2026-10-22 16:41:52.107541+07	Hammam Al Fakkar
227	2026-10-22 16:42:01.008824+07	qa	qa	login	user	qa	\N	\N	web	\N	\N	User qa login berhasil	2026-10-22 16:42:01.008824+07	uji_qa
228	2026-10-22 16:42:17.948516+07	Hammam	admin	role_delete	role	test	{"key": "test", "name": "test", "description": null, "permissions": {"alarm": "none", "roles": "none", "trend": "none", "users": "none", "formula": "none", "products": "none", "audit_log": "none", "dashboard": "edit", "plc_clock": "none", "calibration": "none", "data_report": "none", "machine_params": "none", "manual_control": "none", "action.batch_control": "none", "action.write_calibration": "none", "action.write_safety_params": "none"}}	\N	web	\N	\N	Role test dihapus oleh Hammam	2026-10-22 16:42:17.948516+07	Hammam Al Fakkar
229	2026-10-22 16:43:06.288163+07	Hammam	admin	delete_user	user	qa	{"roleKey": "qa", "fullName": "uji_qa", "isActive": true, "roleName": "QA", "role_key": "qa", "username": "qa", "full_name": "uji_qa", "is_active": true, "role_name": "QA"}	\N	web	\N	\N	User qa (QA) dihapus secara permanen oleh Hammam	2026-10-22 16:43:06.288163+07	Hammam Al Fakkar
230	2026-10-26 14:24:31.86239+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-26 14:24:31.86239+07	Hammam Al Fakkar
231	2026-10-26 15:06:54.467466+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-26 15:06:54.467466+07	Hammam Al Fakkar
232	2026-10-26 15:06:58.564855+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-26 15:06:58.564855+07	Hammam Al Fakkar
233	2026-10-26 15:07:01.052805+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-26 15:07:01.052805+07	Hammam Al Fakkar
234	2026-10-26 15:07:03.911976+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-26 15:07:03.911976+07	Hammam Al Fakkar
235	2026-10-26 15:17:19.662976+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-26 15:17:19.662976+07	Hammam Al Fakkar
236	2026-10-26 15:17:26.008638+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-26 15:17:26.008638+07	Hammam Al Fakkar
237	2026-10-26 15:18:25.961086+07	Hammam	admin	create_user	user	KKV	\N	{"role": "qa", "roleId": 3, "fullName": "Quality Ansurance", "username": "KKV"}	web	\N	\N	User KKV (QA) dibuat oleh Hammam	2026-10-26 15:18:25.961086+07	Hammam Al Fakkar
238	2026-10-26 15:18:41.986233+07	KKV	\N	login_failed	user	KKV	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "KKV"	2026-10-26 15:18:41.986233+07	Quality Ansurance
239	2026-10-26 15:18:47.208741+07	KKV	qa	login	user	KKV	\N	\N	web	\N	\N	User KKV login berhasil	2026-10-26 15:18:47.208741+07	Quality Ansurance
240	2026-10-26 15:22:34.276385+07	Hammam	admin	update_user	user	wsa	{"role": "operator", "fullName": "Wahyu Syahputra", "isActive": true}	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:22:34.276385+07	Hammam Al Fakkar
241	2026-10-26 15:22:42.825192+07	Hammam	admin	update_user	user	wsa	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	{"role": "maintainer", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:22:42.825192+07	Hammam Al Fakkar
242	2026-10-26 15:22:42.825192+07	Hammam	admin	user_role_change	user	wsa	{"role": "operator", "roleId": 1}	{"role": "maintainer", "roleId": 2}	web	\N	\N	Role user wsa diubah dari Operator ke Maintainer oleh Hammam	2026-10-26 15:22:42.825192+07	Hammam Al Fakkar
243	2026-10-26 15:22:51.659635+07	Hammam	admin	update_user	user	wsa	{"role": "maintainer", "fullName": "Wahyu Prasetyo", "isActive": true}	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:22:51.659635+07	Hammam Al Fakkar
244	2026-10-26 15:22:51.659635+07	Hammam	admin	user_role_change	user	wsa	{"role": "maintainer", "roleId": 2}	{"role": "operator", "roleId": 1}	web	\N	\N	Role user wsa diubah dari Maintainer ke Operator oleh Hammam	2026-10-26 15:22:51.659635+07	Hammam Al Fakkar
245	2026-10-26 15:23:03.19823+07	Hammam	admin	update_user	user	wsa	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	{"role": "maintainer", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:23:03.19823+07	Hammam Al Fakkar
246	2026-10-26 15:23:03.19823+07	Hammam	admin	user_role_change	user	wsa	{"role": "operator", "roleId": 1}	{"role": "maintainer", "roleId": 2}	web	\N	\N	Role user wsa diubah dari Operator ke Maintainer oleh Hammam	2026-10-26 15:23:03.19823+07	Hammam Al Fakkar
247	2026-10-26 15:23:23.340406+07	wsa	maintainer	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-26 15:23:23.340406+07	Wahyu Prasetyo
248	2026-10-26 15:24:53.802822+07	wsa	maintainer	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-26 15:24:53.802822+07	Wahyu Prasetyo
249	2026-10-26 15:25:00.566067+07	Hammam	admin	deactivate_user	user	wsa	\N	\N	web	\N	\N	User wsa dinonaktifkan oleh Hammam	2026-10-26 15:25:00.566067+07	Hammam Al Fakkar
250	2026-10-26 15:25:13.961603+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "unknown_or_inactive_user"}	web	\N	\N	Login gagal untuk username "wsa"	2026-10-26 15:25:13.961603+07	Wahyu Prasetyo
251	2026-10-26 15:25:21.55132+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "unknown_or_inactive_user"}	web	\N	\N	Login gagal untuk username "wsa"	2026-10-26 15:25:21.55132+07	Wahyu Prasetyo
252	2026-10-26 15:25:32.963633+07	Hammam	admin	update_user	user	wsa	{"role": "maintainer", "fullName": "Wahyu Prasetyo", "isActive": false}	{"role": "maintainer", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:25:32.963633+07	Hammam Al Fakkar
253	2026-10-26 15:25:36.142364+07	wsa	maintainer	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-26 15:25:36.142364+07	Wahyu Prasetyo
254	2026-10-26 15:26:16.793228+07	Hammam	admin	reset_password	user	wsa	\N	\N	web	\N	\N	Password user wsa di-reset oleh Hammam	2026-10-26 15:26:16.793228+07	Hammam Al Fakkar
255	2026-10-26 15:26:20.620188+07	wsa	maintainer	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-26 15:26:20.620188+07	Wahyu Prasetyo
256	2026-10-26 15:26:26.577272+07	wsa	maintainer	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-26 15:26:26.577272+07	Wahyu Prasetyo
257	2026-10-26 15:26:29.187863+07	wsa	maintainer	logout	user	wsa	\N	\N	web	\N	\N	User wsa logout	2026-10-26 15:26:29.187863+07	Wahyu Prasetyo
258	2026-10-26 15:26:34.216165+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "wsa"	2026-10-26 15:26:34.216165+07	Wahyu Prasetyo
259	2026-10-26 15:26:55.138145+07	KKV	qa	unlock_screen	user	KKV	\N	\N	web	\N	\N	Layar dibuka kembali oleh Quality Ansurance (KKV)	2026-10-26 15:26:55.138145+07	Quality Ansurance
260	2026-10-26 15:27:35.232422+07	Hammam	admin	role_permissions_update	role	qa	{"roles": "edit"}	{"roles": "none"}	web	\N	\N	Izin role QA diubah oleh Hammam (1 resource)	2026-10-26 15:27:35.232422+07	Hammam Al Fakkar
261	2026-10-26 15:27:45.571015+07	Hammam	admin	role_permissions_update	role	qa	{"roles": "none"}	{"roles": "view"}	web	\N	\N	Izin role QA diubah oleh Hammam (1 resource)	2026-10-26 15:27:45.571015+07	Hammam Al Fakkar
265	2026-10-26 15:28:48.987499+07	Hammam	admin	update_user	user	wsa	{"role": "maintainer", "fullName": "Wahyu Prasetyo", "isActive": true}	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:28:48.987499+07	Hammam Al Fakkar
266	2026-10-26 15:28:48.987499+07	Hammam	admin	user_role_change	user	wsa	{"role": "maintainer", "roleId": 2}	{"role": "operator", "roleId": 1}	web	\N	\N	Role user wsa diubah dari Maintainer ke Operator oleh Hammam	2026-10-26 15:28:48.987499+07	Hammam Al Fakkar
267	2026-10-26 15:29:02.08956+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-26 15:29:02.08956+07	Wahyu Prasetyo
268	2026-10-26 15:29:22.316304+07	Hammam	admin	update_user	user	wsa	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	{"role": "qa", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 15:29:22.316304+07	Hammam Al Fakkar
269	2026-10-26 15:29:22.316304+07	Hammam	admin	user_role_change	user	wsa	{"role": "operator", "roleId": 1}	{"role": "qa", "roleId": 3}	web	\N	\N	Role user wsa diubah dari Operator ke QA oleh Hammam	2026-10-26 15:29:22.316304+07	Hammam Al Fakkar
270	2026-10-26 16:06:45.819152+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-26 16:06:45.819152+07	Hammam Al Fakkar
271	2026-10-26 16:06:59.013133+07	Hammam	admin	role_permissions_update	role	qa	{"roles": "view"}	{"roles": "edit"}	web	\N	\N	Izin role QA diubah oleh Hammam (1 resource)	2026-10-26 16:06:59.013133+07	Hammam Al Fakkar
272	2026-10-26 16:07:13.289621+07	Hammam	admin	update_user	user	wsa	{"role": "qa", "fullName": "Wahyu Prasetyo", "isActive": true}	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-26 16:07:13.289621+07	Hammam Al Fakkar
273	2026-10-26 16:07:13.289621+07	Hammam	admin	user_role_change	user	wsa	{"role": "qa", "roleId": 3}	{"role": "operator", "roleId": 1}	web	\N	\N	Role user wsa diubah dari QA ke Operator oleh Hammam	2026-10-26 16:07:13.289621+07	Hammam Al Fakkar
274	2026-10-26 16:07:49.275904+07	Hammam	admin	role_create	role	uji_dash	\N	{"key": "uji_dash", "name": "uji_dash", "description": null, "permissions": {"alarm": "none", "roles": "none", "trend": "none", "users": "none", "formula": "none", "products": "none", "audit_log": "none", "dashboard": "none", "plc_clock": "none", "calibration": "none", "data_report": "none", "machine_params": "none", "manual_control": "none", "action.batch_control": "none", "action.write_calibration": "none", "action.write_safety_params": "none"}}	web	\N	\N	Role uji_dash dibuat oleh Hammam	2026-10-26 16:07:49.275904+07	Hammam Al Fakkar
275	2026-10-26 16:08:02.035465+07	Hammam	admin	role_permissions_update	role	uji_dash	{"dashboard": "none"}	{"dashboard": "view"}	web	\N	\N	Izin role uji_dash diubah oleh Hammam (1 resource)	2026-10-26 16:08:02.035465+07	Hammam Al Fakkar
276	2026-10-26 16:10:43.0959+07	Hammam	admin	create_user	user	uji_dash	\N	{"role": "uji_dash", "roleId": 6, "fullName": "uji_dash", "username": "uji_dash"}	web	\N	\N	User uji_dash (uji_dash) dibuat oleh Hammam	2026-10-26 16:10:43.0959+07	Hammam Al Fakkar
277	2026-10-26 16:13:40.579031+07	wsa	operator	login	user	wsa	\N	\N	web	\N	\N	User wsa login berhasil	2026-10-26 16:13:40.579031+07	Wahyu Prasetyo
278	2026-10-26 16:13:41.178067+07	wsa	operator	export_batch_records	batch	\N	\N	{"to": "2000-01-02", "from": "2000-01-01", "format": "json", "rowCount": 0}	web	\N	\N	Export batch records oleh wsa: 0 baris, format=json	2026-10-26 16:13:41.178067+07	Wahyu Prasetyo
279	2026-10-26 16:13:48.539814+07	KKV	qa	login	user	KKV	\N	\N	web	\N	\N	User KKV login berhasil	2026-10-26 16:13:48.539814+07	Quality Ansurance
280	2026-10-26 16:13:48.98948+07	KKV	qa	export_batch_records	batch	\N	\N	{"to": "2000-01-02", "from": "2000-01-01", "format": "json", "rowCount": 0}	web	\N	\N	Export batch records oleh KKV: 0 baris, format=json	2026-10-26 16:13:48.98948+07	Quality Ansurance
281	2026-10-26 16:13:49.646378+07	KKV	qa	export_audit_log	audit_log	\N	\N	{"to": "2000-01-02", "from": "2000-01-01", "format": "json", "rowCount": 0}	web	\N	\N	Export audit log oleh KKV: 0 baris, format=json	2026-10-26 16:13:49.646378+07	Quality Ansurance
282	2026-10-26 16:13:50.858783+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-26 16:13:50.858783+07	Hammam Al Fakkar
283	2026-10-26 16:13:51.305554+07	Hammam	admin	export_batch_records	batch	\N	\N	{"to": "2000-01-02", "from": "2000-01-01", "format": "json", "rowCount": 0}	web	\N	\N	Export batch records oleh Hammam: 0 baris, format=json	2026-10-26 16:13:51.305554+07	Hammam Al Fakkar
284	2026-10-26 16:13:51.854423+07	Hammam	admin	export_audit_log	audit_log	\N	\N	{"to": "2000-01-02", "from": "2000-01-01", "format": "json", "rowCount": 0}	web	\N	\N	Export audit log oleh Hammam: 0 baris, format=json	2026-10-26 16:13:51.854423+07	Hammam Al Fakkar
285	2026-10-26 16:13:52.888307+07	uji_dash	uji_dash	login	user	uji_dash	\N	\N	web	\N	\N	User uji_dash login berhasil	2026-10-26 16:13:52.888307+07	uji_dash
286	2026-10-26 16:25:27.706385+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-26 16:25:27.706385+07	Hammam Al Fakkar
287	2026-10-26 16:25:32.482642+07	Hammam	admin	unlock_screen_failed	user	Hammam	\N	\N	web	\N	\N	Percobaan membuka kunci layar gagal untuk "Hammam" (password salah)	2026-10-26 16:25:32.482642+07	Hammam Al Fakkar
288	2026-10-26 16:25:38.478394+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-26 16:25:38.478394+07	Hammam Al Fakkar
289	2026-10-26 16:25:43.246478+07	Hammam	admin	delete_user	user	uji_dash	{"roleKey": "uji_dash", "fullName": "uji_dash", "isActive": true, "roleName": "uji_dash", "role_key": "uji_dash", "username": "uji_dash", "full_name": "uji_dash", "is_active": true, "role_name": "uji_dash"}	\N	web	\N	\N	User uji_dash (uji_dash) dihapus secara permanen oleh Hammam	2026-10-26 16:25:43.246478+07	Hammam Al Fakkar
290	2026-10-26 16:44:51.917091+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-26 16:44:51.917091+07	Hammam Al Fakkar
291	2026-10-27 08:53:26.805452+07	Hammam	admin	login	user	Hammam	\N	\N	web	\N	\N	User Hammam login berhasil	2026-10-27 08:53:26.805452+07	Hammam Al Fakkar
292	2026-10-27 10:15:44.323337+07	Hammam	admin	unlock_screen	user	Hammam	\N	\N	web	\N	\N	Layar dibuka kembali oleh Hammam Al Fakkar (Hammam)	2026-10-27 10:15:44.323337+07	Hammam Al Fakkar
293	2026-10-27 10:16:15.896525+07	Hammam	admin	deactivate_user	user	wsa	\N	\N	web	\N	\N	User wsa dinonaktifkan oleh Hammam	2026-10-27 10:16:15.896525+07	Hammam Al Fakkar
294	2026-10-27 10:16:30.318037+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "inactive_account"}	web	\N	\N	Login ditolak: akun "wsa" nonaktif	2026-10-27 10:16:30.318037+07	Wahyu Prasetyo
295	2026-10-27 10:16:39.516902+07	wsa	\N	login_failed	user	wsa	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "wsa"	2026-10-27 10:16:39.516902+07	Wahyu Prasetyo
296	2026-10-27 10:16:58.862776+07	Hammam	admin	update_user	user	wsa	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": false}	{"role": "operator", "fullName": "Wahyu Prasetyo", "isActive": true}	web	\N	\N	User wsa diperbarui oleh Hammam	2026-10-27 10:16:58.862776+07	Hammam Al Fakkar
297	2026-10-27 10:17:50.818101+07	Hammam	admin	create_user	user	testis	\N	{"role": "operator", "roleId": 1, "fullName": "tistes", "username": "testis"}	web	\N	\N	User testis (Operator) dibuat oleh Hammam	2026-10-27 10:17:50.818101+07	Hammam Al Fakkar
298	2026-10-27 10:24:37.686626+07	testis	\N	login_failed	user	testis	\N	{"reason": "wrong_password"}	web	\N	\N	Login gagal untuk username "testis"	2026-10-27 10:24:37.686626+07	tistes
299	2026-10-27 10:24:45.290096+07	Hammam	admin	delete_user	user	testis	{"roleKey": "operator", "fullName": "tistes", "isActive": true, "roleName": "Operator", "role_key": "operator", "username": "testis", "full_name": "tistes", "is_active": true, "role_name": "Operator"}	\N	web	\N	\N	User testis (Operator) dihapus secara permanen oleh Hammam	2026-10-27 10:24:45.290096+07	Hammam Al Fakkar
300	2026-10-27 10:24:51.614666+07	testis	\N	login_failed	user	testis	\N	{"reason": "unknown_user"}	web	\N	\N	Login gagal untuk username "testis"	2026-10-27 10:24:51.614666+07	tistes
301	2026-10-27 10:24:52.345945+07	testis	\N	login_failed	user	testis	\N	{"reason": "unknown_user"}	web	\N	\N	Login gagal untuk username "testis"	2026-10-27 10:24:52.345945+07	tistes
302	2026-10-27 10:24:52.607533+07	testis	\N	login_failed	user	testis	\N	{"reason": "unknown_user"}	web	\N	\N	Login gagal untuk username "testis"	2026-10-27 10:24:52.607533+07	tistes
303	2026-10-27 10:24:52.952216+07	testis	\N	login_failed	user	testis	\N	{"reason": "unknown_user"}	web	\N	\N	Login gagal untuk username "testis"	2026-10-27 10:24:52.952216+07	tistes
304	2026-10-27 10:25:05.764235+07	testis	\N	login_blocked	user	testis	\N	{"maxFails": 5, "windowMin": 15, "retryAfterSec": 872}	web	\N	\N	Login testis diblokir sementara setelah 5 percobaan gagal	2026-10-27 10:25:05.764235+07	tistes
\.


--
-- Data for Name: batch_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.batch_records (id, batch_no, loading_no, operator, machine_id, recipe_id, product_name, product_spec, ctrl_type, ster_temp, cool_temp, heat_begin, ster_begin, cool_begin, run_begin, run_finish, heat_time_min, ster_time_min, cool_time_min, total_time_min, fo1, fo2, fo3, fo4, fo5, fo6, foh, fom, fol, status, created_at, fo_min, sterilization_result, f0_meta, recipe_snapshot, operator_username) FROM stdin;
1	Test-01	001	test	test001	2	testing	enak	Level	115	95	\N	\N	\N	2026-09-22 16:51:51.449496+07	2026-09-22 16:54:26.308948+07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	finished	2026-09-22 16:51:51.449496+07	\N	\N	\N	\N	\N
3	092910	210129	Bot	0012	2	WFI	Paracetamol	Level	115	95	\N	\N	\N	2026-09-23 11:35:55.624698+07	2026-09-23 14:07:38.959256+07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	finished	2026-09-23 11:35:55.624698+07	\N	\N	\N	\N	\N
8	SIM-PRINT-001	11655	tester	SG-40	1	Sodium Chloride 0.9% Generik	500 mL	Time	121	55	2026-10-03 10:22:07+07	2026-10-03 10:53:00+07	2026-10-03 11:08:00+07	2026-10-03 10:21:00+07	2026-10-03 11:48:00+07	30.77	15	37.9	87.0	23.598931264175846	26.478436380208866	22.0238040965047	23.061754006130432	24.711114630209444	22.536804395317404	29.709294259654826	28.372155753899563	29.03302815886353	finished	2026-10-03 11:51:50.373784+07	22.0238040965047	pass	\N	\N	\N
9	TEST-MANUAL-1	1	tester	M1	1	test	test	Time	121	55	\N	\N	\N	2026-10-07 11:34:34.915024+07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	finished	2026-10-07 11:34:34.915024+07	\N	\N	\N	{"version": 1, "recipeId": 1, "formulaNo": "121", "sterilTemp": 121, "controlType": "Time", "foValSetting": 6, "sterilTimeMin": 15}	\N
10	EXT 10.10.26 11.21	N/A	system	SG-40	\N	-	-	Time	121	53	2026-10-10 11:21:54.932815+07	2026-10-10 11:21:54.932815+07	2026-10-10 11:34:40.936488+07	2026-10-10 11:21:51.003404+07	2026-10-10 12:07:59.071905+07	33.15	15	31.416666666666668	46.1	27.805332807227735	29.819052637496956	27.387965159107193	27.2587389882058	26.52106095390432	27.26478114978792	21.00732712379621	26.98502676127967	28.65721650479762	finished	2026-10-10 11:21:51.003404+07	21.00732712379621	\N	{"z": 10, "tRef": 121, "lastTs": "2026-10-10T05:09:49.475Z", "method": "trapezoid", "firstTs": "2026-10-10T04:21:54.962Z", "complete": true, "rowCount": 50, "maxGapSec": 150, "perSensor": {"fo1": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fo2": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fo3": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fo4": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fo5": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fo6": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "foh": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fol": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}, "fom": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 47.91}}, "tempRange": [0, 200]}	{"source": "plc_readback", "version": 1, "recipeId": null, "alarmPres": 240, "formulaNo": null, "spaceTemp": 0.6, "capturedAt": "2026-10-10T04:21:50.999Z", "sterilTemp": 121, "controlTemp": 121.5, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 53, "foValSetting": null, "sterilTimeMin": 15, "adoptedAtPhase": 4, "sterilMaterial": null}	\N
11	KOSONGAN 13.10.26	N/A	Hammam Al Fakkar	SG-40	1	-	-	Time	121	55	2026-10-13 10:54:46.480123+07	2026-10-13 11:10:16.72281+07	2026-10-13 11:25:18.769889+07	2026-10-13 10:53:43.744354+07	2026-10-13 11:46:40.320972+07	15.566666666666666	15	19.266666666666666	52.9	34.01513132975853	36.472944487298804	34.736747550095714	34.42432363787466	34.78938455943539	33.97842532242771	35.82160074626356	33.56974799877585	47.50281080729109	finished	2026-10-13 10:53:43.744354+07	33.56974799877585	\N	{"z": 10, "tRef": 121, "lastTs": "2026-10-13T04:47:45.419Z", "method": "trapezoid", "firstTs": "2026-10-13T03:53:45.620Z", "complete": true, "rowCount": 55, "maxGapSec": 150, "perSensor": {"fo1": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fo2": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fo3": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fo4": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fo5": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fo6": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "foh": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fol": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}, "fom": {"gaps": [], "invalid": [], "gapCount": 0, "invalidCount": 0, "integratedMin": 54}}, "tempRange": [0, 200]}	{"version": 1, "recipeId": 1, "alarmPres": 240, "formulaNo": "121", "spaceTemp": 0.6, "capturedAt": "2026-10-13T03:53:36.459Z", "sterilTemp": 121, "controlTemp": 121, "controlType": "Time", "coolingTemp1": 100, "coolingTemp2": 55, "foValSetting": 6, "sterilTimeMin": 15, "sterilMaterial": "Soft bottle", "recipeUpdatedAt": "2026-10-07T04:36:32.954Z"}	\N
\.


--
-- Data for Name: batch_trend; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.batch_trend (id, batch_id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg, phase_code, cond) FROM stdin;
121	8	2026-10-03 10:21:00+07	25	25.5	24.7	24.9	25.2	24.8	0	26	25.8	25.9	25.9	2	200
122	8	2026-10-03 10:22:00+07	28	28.5	27.7	27.9	28.2	27.8	5	29	28.8	28.9	28.9	3	200
123	8	2026-10-03 10:23:00+07	31	31.5	30.7	30.9	31.2	30.8	10	32	31.8	31.9	31.9	3	200
124	8	2026-10-03 10:24:00+07	34	34.5	33.7	33.9	34.2	33.8	15	35	34.8	34.9	34.9	3	200
125	8	2026-10-03 10:25:00+07	37	37.5	36.7	36.9	37.2	36.8	20	38	37.8	37.9	37.9	3	200
126	8	2026-10-03 10:26:00+07	40	40.5	39.7	39.9	40.2	39.8	25	41	40.8	40.9	40.9	3	200
127	8	2026-10-03 10:27:00+07	43	43.5	42.7	42.9	43.2	42.8	30	44	43.8	43.9	43.9	3	200
128	8	2026-10-03 10:28:00+07	46	46.5	45.7	45.9	46.2	45.8	35	47	46.8	46.9	46.9	3	200
129	8	2026-10-03 10:29:00+07	49	49.5	48.7	48.9	49.2	48.8	40	50	49.8	49.9	49.9	3	200
130	8	2026-10-03 10:30:00+07	52	52.5	51.7	51.9	52.2	51.8	45	53	52.8	52.9	52.9	3	200
131	8	2026-10-03 10:31:00+07	55	55.5	54.7	54.9	55.2	54.8	50	56	55.8	55.9	55.9	3	200
132	8	2026-10-03 10:32:00+07	58	58.5	57.7	57.9	58.2	57.8	55	59	58.8	58.9	58.9	3	200
133	8	2026-10-03 10:33:00+07	61	61.5	60.7	60.9	61.2	60.8	60	62	61.8	61.9	61.9	3	200
134	8	2026-10-03 10:34:00+07	64	64.5	63.7	63.9	64.2	63.8	65	65	64.8	64.9	64.9	3	200
135	8	2026-10-03 10:35:00+07	67	67.5	66.7	66.9	67.2	66.8	70	68	67.8	67.9	67.9	3	200
136	8	2026-10-03 10:36:00+07	70	70.5	69.7	69.9	70.2	69.8	75	71	70.8	70.9	70.9	3	200
137	8	2026-10-03 10:37:00+07	73	73.5	72.7	72.9	73.2	72.8	80	74	73.8	73.9	73.9	3	200
138	8	2026-10-03 10:38:00+07	76	76.5	75.7	75.9	76.2	75.8	85	77	76.8	76.9	76.9	3	200
139	8	2026-10-03 10:39:00+07	79	79.5	78.7	78.9	79.2	78.8	90	80	79.8	79.9	79.9	3	200
140	8	2026-10-03 10:40:00+07	82	82.5	81.7	81.9	82.2	81.8	95	83	82.8	82.9	82.9	3	200
141	8	2026-10-03 10:41:00+07	85	85.5	84.7	84.9	85.2	84.8	100	86	85.8	85.9	85.9	3	200
142	8	2026-10-03 10:42:00+07	88	88.5	87.7	87.9	88.2	87.8	105	89	88.8	88.9	88.9	3	200
143	8	2026-10-03 10:43:00+07	91	91.5	90.7	90.9	91.2	90.8	110	92	91.8	91.9	91.9	3	200
144	8	2026-10-03 10:44:00+07	94	94.5	93.7	93.9	94.2	93.8	115	95	94.8	94.9	94.9	3	200
145	8	2026-10-03 10:45:00+07	97	97.5	96.7	96.9	97.2	96.8	120	98	97.8	97.9	97.9	3	200
146	8	2026-10-03 10:46:00+07	100	100.5	99.7	99.9	100.2	99.8	125	101	100.8	100.9	100.9	3	200
147	8	2026-10-03 10:47:00+07	103	103.5	102.7	102.9	103.2	102.8	130	104	103.8	103.9	103.9	3	200
148	8	2026-10-03 10:48:00+07	106	106.5	105.7	105.9	106.2	105.8	135	107	106.8	106.9	106.9	3	200
149	8	2026-10-03 10:49:00+07	109	109.5	108.7	108.9	109.2	108.8	140	110	109.8	109.9	109.9	3	200
150	8	2026-10-03 10:50:00+07	112	112.5	111.7	111.9	112.2	111.8	145	113	112.8	112.9	112.9	3	200
151	8	2026-10-03 10:51:00+07	115	115.5	114.7	114.9	115.2	114.8	150	116	115.8	115.9	115.9	3	200
152	8	2026-10-03 10:52:00+07	118	118.5	117.7	117.9	118.2	117.8	155	119	118.8	118.9	118.9	3	200
153	8	2026-10-03 10:53:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
154	8	2026-10-03 10:54:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
155	8	2026-10-03 10:55:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
156	8	2026-10-03 10:56:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
157	8	2026-10-03 10:57:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
158	8	2026-10-03 10:58:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
159	8	2026-10-03 10:59:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
160	8	2026-10-03 11:00:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
161	8	2026-10-03 11:01:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
162	8	2026-10-03 11:02:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
163	8	2026-10-03 11:03:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
164	8	2026-10-03 11:04:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
165	8	2026-10-03 11:05:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
166	8	2026-10-03 11:06:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
167	8	2026-10-03 11:07:00+07	122	122.5	121.7	121.9	122.2	121.8	170	123	122.8	122.9	122.9	4	200
168	8	2026-10-03 11:08:00+07	122.0	122.5	121.7	121.9	122.2	121.8	170	123.0	122.8	122.9	122.9	5	200
169	8	2026-10-03 11:09:00+07	120.2	120.7	119.9	120.1	120.4	120.0	166	121.2	121.0	121.1	121.1	5	200
170	8	2026-10-03 11:10:00+07	118.4	118.9	118.1	118.3	118.6	118.2	162	119.4	119.2	119.3	119.3	5	200
171	8	2026-10-03 11:11:00+07	116.6	117.1	116.3	116.5	116.8	116.4	158	117.6	117.4	117.5	117.5	5	200
172	8	2026-10-03 11:12:00+07	114.8	115.3	114.5	114.7	115.0	114.6	154	115.8	115.6	115.7	115.7	5	200
173	8	2026-10-03 11:13:00+07	113.0	113.5	112.7	112.9	113.2	112.8	150	114.0	113.8	113.9	113.9	5	200
174	8	2026-10-03 11:14:00+07	111.2	111.7	110.9	111.1	111.4	111.0	146	112.2	112.0	112.1	112.1	5	200
175	8	2026-10-03 11:15:00+07	109.4	109.9	109.1	109.3	109.6	109.2	142	110.4	110.2	110.3	110.3	5	200
176	8	2026-10-03 11:16:00+07	107.6	108.1	107.3	107.5	107.8	107.4	138	108.6	108.4	108.5	108.5	5	200
177	8	2026-10-03 11:17:00+07	105.8	106.3	105.5	105.7	106.0	105.6	134	106.8	106.6	106.7	106.7	5	200
178	8	2026-10-03 11:18:00+07	104.0	104.5	103.7	103.9	104.2	103.8	130	105.0	104.8	104.9	104.9	5	200
179	8	2026-10-03 11:19:00+07	102.2	102.7	101.9	102.1	102.4	102.0	126	103.2	103.0	103.1	103.1	5	200
180	8	2026-10-03 11:20:00+07	100.4	100.9	100.1	100.3	100.6	100.2	122	101.4	101.2	101.3	101.3	5	200
181	8	2026-10-03 11:21:00+07	98.6	99.1	98.3	98.5	98.8	98.4	118	99.6	99.4	99.5	99.5	5	200
182	8	2026-10-03 11:22:00+07	96.8	97.3	96.5	96.7	97.0	96.6	114	97.8	97.6	97.7	97.7	5	200
183	8	2026-10-03 11:23:00+07	95.0	95.5	94.7	94.9	95.2	94.8	110	96.0	95.8	95.9	95.9	5	200
184	8	2026-10-03 11:24:00+07	93.2	93.7	92.9	93.1	93.4	93.0	106	94.2	94.0	94.1	94.1	5	200
185	8	2026-10-03 11:25:00+07	91.4	91.9	91.1	91.3	91.6	91.2	102	92.4	92.2	92.3	92.3	5	200
186	8	2026-10-03 11:26:00+07	89.6	90.1	89.3	89.5	89.8	89.4	98	90.6	90.4	90.5	90.5	5	200
187	8	2026-10-03 11:27:00+07	87.8	88.3	87.5	87.7	88.0	87.6	94	88.8	88.6	88.7	88.7	5	200
188	8	2026-10-03 11:28:00+07	86.0	86.5	85.7	85.9	86.2	85.8	90	87.0	86.8	86.9	86.9	5	200
189	8	2026-10-03 11:29:00+07	84.2	84.7	83.9	84.1	84.4	84.0	86	85.2	85.0	85.1	85.1	5	200
190	8	2026-10-03 11:30:00+07	82.4	82.9	82.1	82.3	82.6	82.2	82	83.4	83.2	83.3	83.3	5	200
191	8	2026-10-03 11:31:00+07	80.6	81.1	80.3	80.5	80.8	80.4	78	81.6	81.4	81.5	81.5	5	200
192	8	2026-10-03 11:32:00+07	78.8	79.3	78.5	78.7	79.0	78.6	74	79.8	79.6	79.7	79.7	5	200
193	8	2026-10-03 11:33:00+07	77.0	77.5	76.7	76.9	77.2	76.8	70	78.0	77.8	77.9	77.9	5	200
194	8	2026-10-03 11:34:00+07	75.2	75.7	74.9	75.1	75.4	75.0	66	76.2	76.0	76.1	76.1	5	200
195	8	2026-10-03 11:35:00+07	73.4	73.9	73.1	73.3	73.6	73.2	62	74.4	74.2	74.3	74.3	5	200
196	8	2026-10-03 11:36:00+07	71.6	72.1	71.3	71.5	71.8	71.4	58	72.6	72.4	72.5	72.5	5	200
197	8	2026-10-03 11:37:00+07	69.8	70.3	69.5	69.7	70.0	69.6	54	70.8	70.6	70.7	70.7	5	200
198	8	2026-10-03 11:38:00+07	68.0	68.5	67.7	67.9	68.2	67.8	50	69.0	68.8	68.9	68.9	5	200
199	8	2026-10-03 11:39:00+07	66.2	66.7	65.9	66.1	66.4	66.0	46	67.2	67.0	67.1	67.1	5	200
200	8	2026-10-03 11:40:00+07	64.4	64.9	64.1	64.3	64.6	64.2	42	65.4	65.2	65.3	65.3	5	200
201	8	2026-10-03 11:41:00+07	62.6	63.1	62.3	62.5	62.8	62.4	38	63.6	63.4	63.5	63.5	5	200
202	8	2026-10-03 11:42:00+07	60.8	61.3	60.5	60.7	61.0	60.6	34	61.8	61.6	61.7	61.7	5	200
203	8	2026-10-03 11:43:00+07	59.0	59.5	58.7	58.9	59.2	58.8	30	60.0	59.8	59.9	59.9	5	200
204	8	2026-10-03 11:44:00+07	57.2	57.7	56.9	57.1	57.4	57.0	26	58.2	58.0	58.1	58.1	5	200
205	8	2026-10-03 11:45:00+07	55.4	55.9	55.1	55.3	55.6	55.2	22	56.4	56.2	56.3	56.3	5	200
206	8	2026-10-03 11:46:00+07	55	55.5	54.7	54.9	55.2	54.8	18	56	55.8	55.9	55.9	7	200
207	8	2026-10-03 11:47:00+07	55	55.5	54.7	54.9	55.2	54.8	14	56	55.8	55.9	55.9	7	200
208	8	2026-10-03 11:48:00+07	55	55.5	54.7	54.9	55.2	54.8	10	56	55.8	55.9	55.9	6	200
209	8	2026-10-03 11:49:00+07	55	55.5	54.7	54.9	55.2	54.8	6	56	55.8	55.9	55.9	6	200
210	8	2026-10-03 11:50:00+07	55	55.5	54.7	54.9	55.2	54.8	2	56	55.8	55.9	55.9	6	200
211	10	2026-10-10 11:21:54.962918+07	123	123.1	122.5	122.3	121.9	122.1	168	122.6	122.8	123.7	123.03333333333332	4	2018
212	10	2026-10-10 11:22:55.25656+07	123	123.1	122.6	122.5	122.2	122.4	171	124.1	122.8	123.6	123.5	4	2018
213	10	2026-10-10 11:24:00.14521+07	123.2	123.3	122.8	122.7	122.5	122.7	165	121.8	123	124	122.93333333333334	4	2018
214	10	2026-10-10 11:25:05.094053+07	123.1	123.3	122.8	122.8	122.6	122.8	176	125.9	122.9	123.6	124.13333333333333	4	2018
215	10	2026-10-10 11:26:05.527366+07	123.3	123.5	123	123	122.9	123.1	166	121.9	123.1	124.1	123.03333333333335	4	2018
216	10	2026-10-10 11:27:05.567807+07	123.3	123.4	123.1	123	123	123.1	164	121.6	123.1	123.8	122.83333333333333	4	2018
217	10	2026-10-10 11:28:10.347297+07	123.4	123.5	123.2	123.2	123.2	123.2	168	122.1	123.2	124.1	123.13333333333333	4	2018
218	10	2026-10-10 11:29:10.59856+07	123.4	123.5	123.2	123.2	123.2	123.3	166	121.8	123.1	124	122.96666666666665	4	2018
219	10	2026-10-10 11:30:15.722121+07	123.3	123.5	123.2	123.2	123.2	123.3	178	125.5	123.1	123.8	124.13333333333333	4	2018
220	10	2026-10-10 11:31:20.653414+07	123.5	123.7	123.3	123.4	123.4	123.5	168	122.1	123.3	124.3	123.23333333333333	4	2018
221	10	2026-10-10 11:32:20.671671+07	123.4	123.6	123.3	123.4	123.5	123.5	167	121.8	123.3	124.1	123.06666666666666	4	2018
222	10	2026-10-10 11:33:21.332727+07	123.4	123.6	123.3	123.4	123.5	123.5	165	121.6	123.2	123.9	122.90000000000002	4	2018
223	10	2026-10-10 11:34:26.023307+07	123.5	123.7	123.3	123.5	123.6	123.5	171	122.4	123.3	124.2	123.3	4	2018
224	10	2026-10-10 11:34:40.962713+07	123.5	123.7	123.4	123.6	123.6	123.6	170	122.2	123.3	124.4	123.3	5	2018
225	10	2026-10-10 11:35:41.319474+07	123.5	123.7	123.5	123.6	123.5	123.5	159	106.4	123.3	123.9	117.86666666666667	5	2018
226	10	2026-10-10 11:36:46.310874+07	122.6	122.9	122.8	122.8	122.2	122.1	162	99	122.6	115.3	112.3	5	2018
227	10	2026-10-10 11:37:51.379139+07	120.3	121.4	121.2	120.8	120.1	120.3	159	93.9	120.7	106.4	107	5	2018
228	10	2026-10-10 11:38:51.517951+07	117.7	119.5	119	118.5	117.9	118.6	155	89.2	118.4	100.6	102.73333333333335	5	2018
229	10	2026-10-10 11:39:56.377603+07	114.4	117.1	116.2	115.7	115.2	116.1	147	84.6	115.4	95.6	98.53333333333335	5	2018
230	10	2026-10-10 11:40:56.508408+07	111.2	114.5	113.4	112.8	112.6	113.9	140	79.8	112.2	91.3	94.43333333333334	5	2018
231	10	2026-10-10 11:41:57.187882+07	107.6	111.6	110.4	109.7	109.8	111.3	131	75	108.7	86.8	90.16666666666667	5	2018
232	10	2026-10-10 11:43:01.880702+07	103.9	108.6	107.2	106.3	106.6	108.6	122	71.1	104.9	82.3	86.10000000000001	5	2018
233	10	2026-10-10 11:44:01.966967+07	100.5	105.6	104.1	103.3	103.7	106.1	115	68	101.4	78.9	82.76666666666667	5	2018
234	10	2026-10-10 11:45:02.375199+07	96.8	102.8	101.2	100.2	100.7	103.3	108	64.2	97.9	75.5	79.2	5	2018
235	10	2026-10-10 11:46:02.51017+07	93.3	99.8	98.1	97.2	97.7	100.7	100	61.4	94.5	72	75.96666666666667	5	2018
236	10	2026-10-10 11:47:07.142904+07	89.7	97	95	93.9	94.7	97.8	92	58.9	91	69	72.96666666666667	5	2018
237	10	2026-10-10 11:48:07.762862+07	86.5	94.2	92.2	91	91.8	95.2	84	56.9	88	66.6	70.5	5	2018
238	10	2026-10-10 11:49:12.368856+07	83.3	91.3	89.4	88	88.8	92.6	75	55	84.7	64.2	67.96666666666665	5	2018
239	10	2026-10-10 11:50:12.478118+07	80.5	88.7	86.8	85.4	86.3	90.3	68	53.5	82.2	62.4	66.03333333333333	5	2018
240	10	2026-10-10 11:51:12.712748+07	77.8	86.4	84.3	82.9	83.8	88.1	61	52	79.7	60.7	64.13333333333333	5	2018
241	10	2026-10-10 11:52:17.454523+07	75.1	83.9	81.8	80.4	81.3	85.7	54	50.7	77.2	59.1	62.333333333333336	5	2018
242	10	2026-10-10 11:53:17.506901+07	72.8	81.8	79.7	78.2	79.1	83.6	52	49.5	75.1	57.6	60.73333333333333	5	2018
243	10	2026-10-10 11:54:18.103348+07	70.5	79.6	77.5	76	77	81.6	51	48.5	73	56.3	59.26666666666667	5	2018
244	10	2026-10-10 11:55:22.797435+07	68.3	77.5	75.4	73.8	74.9	79.6	49	47.5	71	55	57.833333333333336	5	2018
245	10	2026-10-10 11:56:23.215147+07	66.4	75.6	73.6	71.9	73	77.7	48	46.7	69.2	53.9	56.6	5	2018
246	10	2026-10-10 11:57:23.334643+07	64.5	73.7	71.7	70.1	71.3	75.9	47	45.9	67.5	53	55.46666666666667	5	2018
247	10	2026-10-10 11:58:28.229702+07	62.8	71.8	69.9	68.3	69.5	74.2	46	45.1	65.9	52	54.333333333333336	5	2018
248	10	2026-10-10 11:59:28.47697+07	61.1	70.1	68.3	66.7	67.9	72.5	46	44.5	64.4	51.1	53.333333333333336	5	2018
249	10	2026-10-10 12:00:33.546537+07	59.6	68.4	66.7	65	66.3	70.9	46	43.7	62.8	50.2	52.23333333333333	5	2018
250	10	2026-10-10 12:01:38.71867+07	58.1	66.8	65.1	63.4	64.7	69.3	46	43.1	61.4	49.3	51.26666666666667	5	2018
251	10	2026-10-10 12:02:43.488181+07	56.8	65.2	63.6	61.9	63.2	67.8	46	42.6	60.1	48.6	50.43333333333334	5	2018
252	10	2026-10-10 12:03:43.713677+07	55.5	63.8	62.3	60.6	62	66.4	46	42.1	58.9	48	49.666666666666664	5	2018
253	10	2026-10-10 12:04:48.647062+07	54.3	62.4	61	59.3	60.7	65	46	41.7	57.7	47.3	48.9	5	2018
254	10	2026-10-10 12:05:48.814686+07	53.3	61.2	59.9	58.2	59.5	63.7	46	41.2	56.7	46.8	48.23333333333333	5	2018
255	10	2026-10-10 12:06:09.260946+07	53	60.8	59.5	57.8	59.2	63.4	46	41.1	56.3	46.6	48	7	2018
256	10	2026-10-10 12:07:14.411114+07	52.5	60.2	58.8	57.1	58.5	62.6	29	40.7	55.8	43.2	46.56666666666666	7	2018
257	10	2026-10-10 12:07:59.071905+07	52.4	59.9	58.5	56.9	58.2	62.3	16	40.2	55.5	43.2	46.300000000000004	6	2018
258	10	2026-10-10 12:08:59.649635+07	52.3	59.5	58.2	56.6	57.9	62	4	40.3	55.3	43.3	46.29999999999999	6	2018
259	10	2026-10-10 12:09:34.399699+07	52.2	59.3	58	56.5	57.8	61.8	1	40.5	55.2	43.9	46.53333333333333	1	2018
260	10	2026-10-10 12:09:49.475801+07	52.1	59.3	57.9	56.4	57.8	61.8	1	40.6	55.1	44.2	46.63333333333333	0	2018
261	11	2026-10-13 10:53:45.620787+07	47	49.7	51.1	51.8	53.4	55	0	42	50.4	46.2	46.20000000000001	2	2018
262	11	2026-10-13 10:54:46.494693+07	47	49.6	50.9	51.6	53.3	54.8	-2	42.2	50.2	37.5	43.300000000000004	3	2018
263	11	2026-10-13 10:55:50.498413+07	47.4	50.8	51.4	52	53.7	55	36	68.2	50.7	56.6	58.5	3	2018
264	11	2026-10-13 10:56:50.642574+07	52.2	55.2	54.7	55.2	57.7	58	63	82.1	54.4	71.9	69.46666666666667	3	2018
265	11	2026-10-13 10:57:50.738156+07	59.6	62.4	61.5	61.9	64.9	64.4	95	93.6	61.1	84.7	79.8	3	2018
266	11	2026-10-13 10:58:50.789061+07	69.1	71.3	70.2	70.5	73.8	72.6	113	104.3	69.9	95.3	89.83333333333333	3	2018
267	11	2026-10-13 10:59:50.810676+07	79.5	81.3	80.2	80.1	83.4	82.4	140	114.4	80	105.1	99.83333333333333	3	2018
268	11	2026-10-13 11:00:50.989093+07	90.1	91.4	90.5	90.2	93.2	92.2	156	119.3	90.6	113.6	107.83333333333333	3	2018
269	11	2026-10-13 11:01:51.426376+07	99.8	100.4	99.6	99	101.7	101	163	123.6	100	118.7	114.10000000000001	3	2018
270	11	2026-10-13 11:02:51.500295+07	106.8	107.3	106.6	106.1	108.9	108.5	142	120.7	107.3	121.1	116.36666666666667	3	2018
271	11	2026-10-13 11:03:56.226585+07	111.7	112.3	111.4	111.1	113.4	113.3	152	125.1	112.2	121.8	119.7	3	2018
272	11	2026-10-13 11:04:56.515371+07	114.7	115.4	114.6	114.4	116.1	116.1	158	125.4	115.3	122.5	121.06666666666666	3	2018
273	11	2026-10-13 11:06:01.240711+07	117.2	117.9	117.2	116.9	118.1	118.1	150	121.2	117.7	123.3	120.73333333333333	3	2018
274	11	2026-10-13 11:07:01.505098+07	118.7	119.3	118.7	118.3	119	118.8	154	121.4	119.1	123.2	121.23333333333333	3	2018
275	11	2026-10-13 11:08:01.508049+07	120.1	120.6	120	119.6	120.1	120	157	121.7	120.3	123.7	121.89999999999999	3	2018
276	11	2026-10-13 11:09:06.527092+07	120.9	121.4	120.9	120.5	120.7	120.5	160	121.3	121.1	123.5	121.96666666666665	3	2018
277	11	2026-10-13 11:10:06.570189+07	121.4	121.8	121.4	121.1	121.1	120.9	160	121	121.5	123.3	121.93333333333334	3	2018
278	11	2026-10-13 11:10:16.74468+07	121.5	121.9	121.5	121.1	121.2	121	163	121	121.5	123.2	121.89999999999999	4	2018
279	11	2026-10-13 11:11:16.875702+07	122	122.4	122	121.7	121.6	121.4	165	122	122	123.7	122.56666666666666	4	2018
280	11	2026-10-13 11:12:21.826562+07	122.3	122.7	122.4	122.1	122.1	121.9	163	122.3	122.3	123.8	122.8	4	2018
281	11	2026-10-13 11:13:21.912726+07	122.5	122.9	122.6	122.4	122.4	122.2	175	125	122.4	123.8	123.73333333333333	4	2018
282	11	2026-10-13 11:14:22.01473+07	122.9	123.2	123	122.9	122.9	122.8	166	122.4	122.8	124.5	123.23333333333333	4	2018
283	11	2026-10-13 11:15:22.484947+07	123.1	123.4	123.2	123.1	123.2	123.1	164	122.1	123	124.4	123.16666666666667	4	2018
284	11	2026-10-13 11:16:27.153829+07	123.1	123.5	123.3	123.3	123.3	123.2	163	121.9	123.1	124.2	123.06666666666666	4	2018
285	11	2026-10-13 11:17:27.373323+07	123.2	123.5	123.3	123.4	123.4	123.3	162	121.7	123	124.1	122.93333333333332	4	2018
286	11	2026-10-13 11:18:28.003666+07	123.1	123.4	123.3	123.4	123.4	123.3	163	122.6	123	123.9	123.16666666666667	4	2018
287	11	2026-10-13 11:19:32.260325+07	123.4	123.6	123.5	123.6	123.7	123.6	166	122.4	123.3	124.7	123.46666666666665	4	2018
288	11	2026-10-13 11:20:32.460003+07	123.5	123.7	123.6	123.7	123.8	123.7	165	122.2	123.4	124.6	123.40000000000002	4	2018
289	11	2026-10-13 11:21:37.650958+07	123.5	123.7	123.7	123.8	123.8	123.7	163	122	123.4	124.4	123.26666666666667	4	2018
290	11	2026-10-13 11:22:42.434217+07	123.5	123.7	123.7	123.8	123.8	123.7	162	121.8	123.4	124.2	123.13333333333333	4	2018
291	11	2026-10-13 11:23:43.410823+07	123.4	123.7	123.6	123.8	123.8	123.7	161	121.7	123.3	124.1	123.03333333333335	4	2018
292	11	2026-10-13 11:24:43.693534+07	123.4	123.6	123.6	123.7	123.8	123.7	160	121.5	123.3	124	122.93333333333334	4	2018
293	11	2026-10-13 11:25:18.796083+07	123.4	123.6	123.6	123.8	123.8	123.7	171	123.4	123.3	124.1	123.59999999999998	5	2018
294	11	2026-10-13 11:26:19.196589+07	123.6	123.8	123.7	123.8	123.9	123.6	144	104.1	123.4	124.2	117.23333333333333	5	2018
295	11	2026-10-13 11:27:23.729864+07	122.7	122.9	122.5	122.4	122.1	121.6	116	96.3	122.3	114.6	111.06666666666666	5	2018
296	11	2026-10-13 11:28:23.922395+07	120.4	120.5	120.2	119.9	119.3	119.2	108	91.6	120	103.9	105.16666666666667	5	2018
297	11	2026-10-13 11:29:24.066767+07	117.2	117.4	117.1	116.9	115.8	116.9	99	84.7	117.4	95.3	99.13333333333334	5	2018
298	11	2026-10-13 11:30:24.092136+07	113.6	114	113.7	113.5	111.5	114.1	95	78.7	114.1	88	93.60000000000001	5	2018
299	11	2026-10-13 11:31:24.137583+07	109.4	109.9	109.6	109.6	106.9	111.1	93	73.1	110.3	81.5	88.3	5	2018
300	11	2026-10-13 11:32:24.182293+07	105.1	105.6	105.6	105.7	102.3	107.8	94	68.2	106.5	75.9	83.53333333333333	5	2018
301	11	2026-10-13 11:33:24.338136+07	100.7	101.3	101.5	101.5	97.6	104.5	93	61.7	102.3	70.6	78.2	5	2018
302	11	2026-10-13 11:34:29.28795+07	95.6	96.3	96.7	96.9	92.3	100.6	91	55.2	97.7	63.4	72.10000000000001	5	2018
303	11	2026-10-13 11:35:29.408685+07	91	91.9	92.4	92.4	87.3	97.1	85	50.6	93.2	58	67.26666666666667	5	2018
304	11	2026-10-13 11:36:30.039641+07	86.1	87.5	88.2	88.1	82.5	93.6	72	47	89	53.6	63.199999999999996	5	2018
305	11	2026-10-13 11:37:34.957653+07	81.3	83	83.9	83.8	77.6	89.9	60	43.9	84.7	49.9	59.5	5	2018
306	11	2026-10-13 11:38:39.8391+07	76.7	78.9	80	79.7	73	86.2	53	41.4	80.8	46.9	56.36666666666667	5	2018
307	11	2026-10-13 11:39:40.000118+07	72.9	75.3	76.6	76.4	69.3	83.2	51	39.6	77.4	44.8	53.93333333333334	5	2018
308	11	2026-10-13 11:40:44.721039+07	69	71.7	73.1	72.8	65.5	79.9	50	38.1	74	43	51.699999999999996	5	2018
309	11	2026-10-13 11:41:44.747+07	65.8	68.5	70	69.8	62.3	77.1	49	37	71.1	41.7	49.93333333333334	5	2018
310	11	2026-10-13 11:42:45.082884+07	62.8	65.6	67.2	67	59.5	74.4	48	36.2	68.5	40.6	48.43333333333334	5	2018
311	11	2026-10-13 11:43:45.288171+07	60.2	63	64.6	64.6	56.9	72	48	35.5	66	39.7	47.06666666666666	5	2018
312	11	2026-10-13 11:44:35.406711+07	58.1	60.9	62.6	62.6	54.9	69.9	47	34.9	64.1	39.1	46.03333333333333	7	2018
313	11	2026-10-13 11:45:40.111694+07	57	59.8	61.4	61.5	54.1	68.7	31	34.7	62.9	37.9	45.166666666666664	7	2018
314	11	2026-10-13 11:46:40.320972+07	56.6	59.3	60.8	60.9	53.7	68	16	34.3	62.4	37.9	44.86666666666667	6	2018
315	11	2026-10-13 11:47:45.419334+07	56.2	58.7	60.2	60.4	53.4	67.3	5	34.7	61.8	38.3	44.93333333333334	6	2018
\.


--
-- Data for Name: monitor_heartbeat; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.monitor_heartbeat (id, beat_at) FROM stdin;
1	2026-10-27 11:02:25.784008+07
\.


--
-- Data for Name: product_names; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_names (id, name, is_active, created_at, updated_at) FROM stdin;
6	N/A	t	2026-10-15 16:35:27.453132+07	2026-10-15 16:35:27.453132+07
7	Water For Irrigation	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
8	Sodium Chloride 0,9%	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
9	Water For Injection	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
10	Ringer Asetat	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
11	Ringer Lactate	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
12	Dextrose anhydrate 5% 500 mL	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
13	Dextrose Anhydrate 5% 250 mL	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
14	Dextrose Anhydrate 10% 500 mL	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
15	Sodium Chloride 3% 500 mL	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
16	PARACETAMOL	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
17	Dextrose Anhydrate 5% / Sodium Chloride 0,9%	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
18	Dextrose Anhydrate 5% / Sodium Chloride 0,45%	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
19	Dextrose Anhydrate 5% / Sodium Chloride 0,225%	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
20	Fluconazole	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
21	Levofloxacin Hemihydrate	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
22	Metronidazole	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
23	Mannitol	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
24	Ciprofloxacin Lactate	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
25	Suryavena Sodium Chloride 0,9%	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
26	Suryavena Water For Injection	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
27	Suryavena Ringer Asetat	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
28	Suryavena Ringer Lactate	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
29	Suryavena Dextrose anhydrate 5 %	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
30	Suryavena Dextrose Anhydrate 10 %	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
31	SATOMOL	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
32	INOLAC	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
33	INOCHI D5-NS	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
34	INOCHI D5-1/2NS	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
35	INOCHI D5-1/4NS	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
36	FLUCORIA	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
37	LEVORIA	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
38	SATONIDAZOLE	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
39	INOCHI MANITOL 20%	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
40	CIPROCIN	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
41	Inochi MD 3A	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
42	Inochi MD 3B	t	2026-10-15 16:50:37.485085+07	2026-10-15 16:50:37.485085+07
\.


--
-- Data for Name: product_specs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_specs (id, spec, is_active, created_at, updated_at) FROM stdin;
5	N/A	t	2026-10-15 16:32:08.523237+07	2026-10-15 16:32:08.523237+07
3	100 ml	t	2026-10-15 16:32:08.523237+07	2026-10-15 16:32:41.356397+07
2	1000 ml	t	2026-10-15 16:32:08.523237+07	2026-10-15 16:33:15.97065+07
4	250 ml	t	2026-10-15 16:32:08.523237+07	2026-10-15 16:33:21.397203+07
1	500 ml	t	2026-10-15 16:32:08.523237+07	2026-10-15 16:33:27.272323+07
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, spec, is_active, created_at, updated_at) FROM stdin;
1	Ringer Lactate	500 ml Soft Bag	t	2026-10-15 15:53:13.514077+07	2026-10-15 15:53:13.514077+07
2	Sodium Chloride 0.9%	500 ml Soft Bag	t	2026-10-15 15:53:13.514077+07	2026-10-15 15:53:13.514077+07
3	Dextrose 5%	500 ml Soft Bag	t	2026-10-15 15:53:13.514077+07	2026-10-15 15:53:13.514077+07
4	Water For Injection	1000 ml Bottle	t	2026-10-15 15:53:13.514077+07	2026-10-15 15:53:13.514077+07
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipes (id, formula_no, control_temp, space_temp, steril_temp, steril_time_min, alarm_pres, cooling_temp1, cooling_temp2, fo_val_setting, control_type, steril_material, created_at, updated_at) FROM stdin;
2	115	115.0	0.5	115.0	20	200	95.0	50.0	5.0	Level	Hard bottle	2026-09-22 16:45:33.385727+07	2026-09-22 16:45:33.385727+07
1	121	121	0.6	121	15	240	100	55	6	Time	Soft bottle	2026-09-22 16:45:33.385727+07	2026-10-07 11:36:32.954602+07
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (role_id, resource, level) FROM stdin;
1	action.write_safety_params	none
1	action.write_calibration	none
1	action.batch_control	edit
1	manual_control	view
1	plc_clock	view
1	machine_params	view
1	calibration	view
1	roles	none
1	users	none
1	audit_log	none
1	products	view
1	formula	view
1	alarm	edit
1	data_report	edit
1	trend	edit
1	dashboard	edit
2	action.write_safety_params	none
2	action.write_calibration	none
2	action.batch_control	edit
2	manual_control	edit
2	plc_clock	view
2	machine_params	edit
2	calibration	view
2	roles	none
2	users	none
2	audit_log	none
2	products	view
2	formula	view
2	alarm	edit
2	data_report	edit
2	trend	edit
2	dashboard	edit
4	action.write_safety_params	edit
4	action.write_calibration	edit
4	action.batch_control	edit
4	manual_control	edit
4	plc_clock	edit
4	machine_params	edit
4	calibration	edit
4	roles	edit
4	users	edit
4	audit_log	view
4	products	edit
4	formula	edit
4	alarm	edit
4	data_report	edit
4	trend	edit
4	dashboard	edit
6	dashboard	view
6	trend	none
6	data_report	none
6	alarm	none
6	formula	none
6	products	none
6	audit_log	none
6	users	none
6	roles	none
6	calibration	none
6	machine_params	none
6	plc_clock	none
6	manual_control	none
6	action.batch_control	none
6	action.write_calibration	none
6	action.write_safety_params	none
3	dashboard	edit
3	trend	edit
3	data_report	edit
3	alarm	edit
3	formula	edit
3	products	edit
3	audit_log	view
3	users	edit
3	roles	edit
3	calibration	edit
3	machine_params	edit
3	plc_clock	edit
3	manual_control	edit
3	action.batch_control	edit
3	action.write_calibration	edit
3	action.write_safety_params	edit
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, key, name, description, is_system, created_at, updated_at) FROM stdin;
1	operator	Operator	Operasional harian: START/STOP, trend, laporan, alarm. Resep, kalibrasi, dan parameter hanya lihat.	t	2026-10-22 09:44:11.932313+07	2026-10-22 09:44:11.932313+07
2	maintainer	Maintainer	Seperti Operator, ditambah ubah parameter mesin (kecuali Safety/Alarm Press) dan kontrol manual.	t	2026-10-22 09:44:11.932313+07	2026-10-22 09:44:11.932313+07
4	admin	Admin	Hak akses sama dengan QA, tetapi dipakai akun terpisah demi akuntabilitas audit.	t	2026-10-22 09:44:11.932313+07	2026-10-22 09:44:11.932313+07
3	qa	QA	Wewenang penuh atas resep, produk, kalibrasi, parameter keselamatan, user, role, dan audit log.	t	2026-10-22 09:44:11.932313+07	2026-10-26 16:06:59.013133+07
6	uji_dash	uji_dash	\N	f	2026-10-26 16:07:49.275904+07	2026-10-26 16:08:02.035465+07
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, full_name, is_active, last_login_at, created_at, updated_at, role_id, deleted_at) FROM stdin;
7	KKV	$2b$10$xdMKhZRjyz9k.4vjwFSBCOxRszrH.jqp3T8jR6uIjFb3fvBWkEgn6	Quality Ansurance	t	2026-10-26 16:13:48.534281+07	2026-10-26 15:18:25.961086+07	2026-10-26 15:18:25.961086+07	3	\N
8	uji_dash	$2b$10$PpNMGMel7xI5.um5b7vA/eS0DP9mfjUzXnC/mlZUVtnNSsKWA7iHW	uji_dash	f	2026-10-26 16:13:52.879236+07	2026-10-26 16:10:43.0959+07	2026-10-26 16:25:43.246478+07	\N	2026-10-26 16:25:43.246478+07
1	Hammam	$2b$10$S68y/lrrgpemOcVuc1mNpu6Uxjxmg1qVn2evHX.EMfmzrTAEDS5we	Hammam Al Fakkar	t	2026-10-27 08:53:26.794936+07	2026-09-23 10:12:41.574159+07	2026-10-09 14:46:19.007204+07	4	\N
4	wsa	$2b$10$JVIdZUw.zvkE8kDnmy2iuOihaLmPBb8856ZzvMTXqdPL0mJn6CXkq	Wahyu Prasetyo	t	2026-10-26 16:13:40.567875+07	2026-10-07 14:58:11.8245+07	2026-10-27 10:16:58.862776+07	1	\N
9	testis	$2b$10$kxGbiVrbGjrGtKSQsBDV4u4oy4vU6Ujl8lkWg3Q.8a/fsRgKZ3.aK	tistes	f	\N	2026-10-27 10:17:50.818101+07	2026-10-27 10:24:45.290096+07	\N	2026-10-27 10:24:45.290096+07
5	fajri	$2b$10$YgXCsIaQ65X9byVIQy.ZyeH5.mxzFbNfjuzEC5ORwoYdPwuUKUkIe	fajri autoclave	f	2026-10-22 15:23:10.99998+07	2026-10-22 10:56:47.219833+07	2026-10-22 16:12:44.659022+07	\N	2026-10-22 16:12:44.659022+07
3	operator	$2b$10$89pi729DnkkZy4T0LbdXpuRjmilUxGk4gqBR9d8JJ0iYqbPbNMIhe	operator	f	\N	2026-09-23 15:17:48.385594+07	2026-10-22 16:14:35.835332+07	\N	2026-10-22 16:14:35.835332+07
2	Operator	$2b$10$vkKMeb4nvfT6YbVb1f8RAuY9NAisQOa/xtkfL/4aH3JJvsWWjTqaG	Operator	f	2026-09-23 14:53:18.361453+07	2026-09-23 14:31:33.062221+07	2026-10-22 16:14:39.873002+07	\N	2026-10-22 16:14:39.873002+07
6	qa	$2b$10$dpjVdteyoxSoE8nXzDFvze5Qtb5f9MmqUKSYbxbEltaujS45TQCsO	uji_qa	f	2026-10-22 16:42:01.006302+07	2026-10-22 16:41:52.107541+07	2026-10-22 16:43:06.288163+07	\N	2026-10-22 16:43:06.288163+07
\.


--
-- Name: alarm_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alarm_log_id_seq', 46, true);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 304, true);


--
-- Name: batch_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.batch_records_id_seq', 11, true);


--
-- Name: batch_trend_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.batch_trend_id_seq', 315, true);


--
-- Name: product_names_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_names_id_seq', 42, true);


--
-- Name: product_specs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_specs_id_seq', 5, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 4, true);


--
-- Name: recipes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recipes_id_seq', 6, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: alarm_log alarm_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alarm_log
    ADD CONSTRAINT alarm_log_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: batch_records batch_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_records
    ADD CONSTRAINT batch_records_pkey PRIMARY KEY (id);


--
-- Name: batch_trend batch_trend_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_trend
    ADD CONSTRAINT batch_trend_pkey PRIMARY KEY (id);


--
-- Name: monitor_heartbeat monitor_heartbeat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monitor_heartbeat
    ADD CONSTRAINT monitor_heartbeat_pkey PRIMARY KEY (id);


--
-- Name: product_names product_names_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_names
    ADD CONSTRAINT product_names_pkey PRIMARY KEY (id);


--
-- Name: product_specs product_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_specs
    ADD CONSTRAINT product_specs_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_formula_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_formula_no_key UNIQUE (formula_no);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, resource);


--
-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: alarm_log_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alarm_log_active_idx ON public.alarm_log USING btree (alarm_date DESC) WHERE (event_type = 'alarm_active'::text);


--
-- Name: alarm_log_episode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alarm_log_episode_idx ON public.alarm_log USING btree (episode_id) WHERE (episode_id IS NOT NULL);


--
-- Name: batch_records_batch_no_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX batch_records_batch_no_uniq ON public.batch_records USING btree (lower(btrim(batch_no)));


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_actor ON public.audit_log USING btree (actor, event_time DESC);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id, event_time DESC);


--
-- Name: idx_audit_log_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_time ON public.audit_log USING btree (event_time DESC);


--
-- Name: idx_batch_trend_batch_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batch_trend_batch_ts ON public.batch_trend USING btree (batch_id, ts);


--
-- Name: idx_users_not_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_not_deleted ON public.users USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: one_running_batch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX one_running_batch ON public.batch_records USING btree (status) WHERE (status = 'running'::text);


--
-- Name: product_names_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_names_active_idx ON public.product_names USING btree (is_active);


--
-- Name: product_names_name_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX product_names_name_uniq ON public.product_names USING btree (lower(btrim((name)::text)));


--
-- Name: product_specs_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_specs_active_idx ON public.product_specs USING btree (is_active);


--
-- Name: product_specs_spec_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX product_specs_spec_uniq ON public.product_specs USING btree (lower(btrim((spec)::text)));


--
-- Name: products_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_active_idx ON public.products USING btree (is_active);


--
-- Name: products_name_spec_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_name_spec_uniq ON public.products USING btree (lower(btrim((name)::text)), lower(btrim((spec)::text)));


--
-- Name: roles_name_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_name_uniq ON public.roles USING btree (lower(btrim(name)));


--
-- Name: audit_log trg_audit_log_actor_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_log_actor_name BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.audit_log_fill_actor_name();


--
-- Name: roles trg_roles_block_system_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_roles_block_system_delete BEFORE DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.roles_block_system_delete();


--
-- Name: batch_records batch_records_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_records
    ADD CONSTRAINT batch_records_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: batch_trend batch_trend_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batch_trend
    ADD CONSTRAINT batch_trend_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batch_records(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

